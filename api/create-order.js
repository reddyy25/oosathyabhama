/*
 * POST /api/create-order
 * Validates the cart on the server, recalculates prices from the products table, checks stock,
 * and inserts the order. The browser never decides the price.
 *
 * Environment variables (all OPTIONAL – defaults match your existing public Supabase config):
 *   SUPABASE_URL                 your Supabase project URL
 *   SUPABASE_PUBLISHABLE_KEY     the public (publishable/anon) key
 *   SUPABASE_SERVICE_ROLE_KEY    OPTIONAL, server-only. If set, orders are written with it so you can
 *                                remove the public "Anyone can submit an order" policy (see ecommerce-upgrade.sql).
 * Never prefix any of these with NEXT_PUBLIC_/VITE_ and never put the service-role key in frontend files.
 */
const DEFAULT_URL = "https://ecglfrrxjkbbhuslgzcf.supabase.co";
const DEFAULT_KEY = "sb_publishable_UanhHKQVHsX80fVtTX1o_g_AJ1Qjz9G";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cfg = () => {
  const url = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, "");
  const readKey = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;
  const writeKey = process.env.SUPABASE_SERVICE_ROLE_KEY || readKey;
  return { url, readKey, writeKey };
};
const hdr = key => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
const send = (res, code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); };
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function validate(body) {
  if (!body || typeof body !== "object") return { error: "Invalid request" };
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length || rawItems.length > 20) return { error: "Your cart is empty or too large" };
  const merged = new Map();
  for (const it of rawItems) {
    const id = String(it && it.product_id || "");
    const size = clean(it && it.size, 10).toUpperCase();
    const qty = Number(it && it.quantity);
    if (!UUID_RE.test(id)) return { error: "Invalid product" };
    if (!/^[A-Z0-9]{1,10}$/.test(size)) return { error: "Please select a valid size" };
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return { error: "Quantity must be between 1 and 10" };
    const key = `${id}|${size}`;
    merged.set(key, { product_id: id.toLowerCase(), size, quantity: Math.min(10, (merged.get(key)?.quantity || 0) + qty) });
  }
  const c = body.customer || {};
  const name = clean(c.name, 120), address = clean(c.address, 1000), phone = clean(c.phone, 20);
  if (!name) return { error: "Please enter your name" };
  if (!address) return { error: "Please enter your delivery address" };
  if (phone && !/^\+?[0-9 \-]{7,20}$/.test(phone)) return { error: "Please enter a valid phone number" };
  const pincode = clean(c.pincode, 6);
  if (!/^[0-9]{6}$/.test(pincode)) return { error: "Please enter a valid 6-digit PIN code" };
  const method = body.payment_method === "upi" ? "upi" : "whatsapp";
  return { lines: [...merged.values()], name, address, pincode, phone, method };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const v = validate(body);
  if (v.error) return send(res, 400, { error: v.error });

  const { url, readKey, writeKey } = cfg();
  const ids = [...new Set(v.lines.map(l => l.product_id))];
  let rows;
  try {
    const r = await fetch(`${url}/rest/v1/products?select=*&is_active=eq.true&id=in.(${ids.join(",")})`, { headers: hdr(readKey) });
    if (!r.ok) throw new Error(`products ${r.status}`);
    rows = await r.json();
  } catch (e) { console.error("create-order: product lookup failed", e.message); return send(res, 502, { error: "Could not reach the store database. Please try again." }); }

  const byId = new Map(rows.map(p => [String(p.id).toLowerCase(), p]));
  const need = new Map();
  for (const l of v.lines) {
    const p = byId.get(l.product_id);
    if (!p) return send(res, 409, { error: "Some items are no longer available. Please refresh your cart." });
    need.set(l.product_id, (need.get(l.product_id) || 0) + l.quantity);
  }
  for (const [id, qty] of need) {
    const p = byId.get(id);
    const price = Number(p.price);
    if (!Number.isFinite(price) || price < 0) return send(res, 409, { error: `${p.name} is not available right now.` });
    if (p.stock !== null && p.stock !== undefined && p.stock !== "") {
      const stock = Number(p.stock);
      if (stock <= 0) return send(res, 409, { error: `${p.name} is out of stock.` });
      if (qty > stock) return send(res, 409, { error: `Only ${stock} of ${p.name} left in stock.` });
    }
  }
  const items = v.lines.map(l => { const p = byId.get(l.product_id); return { product_id: String(p.id), product_name: p.name, size: l.size, quantity: l.quantity, unit_price: Number(p.price) }; });
  const subtotal = Math.round(items.reduce((t, i) => t + i.unit_price * i.quantity, 0) * 100) / 100;
  const delivery = 50;
  const total = Math.round((subtotal + delivery) * 100) / 100;
  const id = require("crypto").randomUUID();
  const base = { id, customer_name: v.name, customer_phone: v.phone || null, customer_address: `${v.address}, PIN: ${v.pincode}`, total_amount: total, status: "pending", items };
  const extra = { payment_method: v.method, payment_status: "unpaid" };

  const insert = async payload => fetch(`${url}/rest/v1/orders`, { method: "POST", headers: { ...hdr(writeKey), Prefer: "return=minimal" }, body: JSON.stringify(payload) });
  try {
    let r = await insert({ ...base, ...extra });
    if (!r.ok) {
      const text = await r.text();
      // Payment columns not added yet (ecommerce-upgrade.sql not run): retry with the original columns only.
      if (/column|schema cache/i.test(text)) r = await insert(base);
      else { console.error("create-order: insert rejected", r.status, text); return send(res, 502, { error: "Could not save your order. Please try again." }); }
      if (!r.ok) { console.error("create-order: insert failed", r.status, await r.text()); return send(res, 502, { error: "Could not save your order. Please try again." }); }
    }
  } catch (e) { console.error("create-order: insert error", e.message); return send(res, 502, { error: "Could not save your order. Please try again." }); }

  return send(res, 201, { order_id: id, ref: id.slice(0, 8), subtotal, delivery, total, items });
}
module.exports = handler;
module.exports._validate = validate;
