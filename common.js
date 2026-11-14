/* ===== Oo_Sathyabhama – shared storefront code (home, product, checkout pages) ===== */
const $ = s => document.querySelector(s);
const ROOT = document.documentElement.dataset.root || "";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IS_LOCAL = location.protocol === "file:" || ["localhost", "127.0.0.1", ""].includes(location.hostname);
const money = n => SHOP.currency + Number(n || 0).toLocaleString("en-IN");
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const assetUrl = p => (/^(https?:|data:|blob:|\/)/i.test(p) ? p : ROOT + p);

function toast(t) {
  const el = $("#toast"); if (!el) return;
  el.textContent = t; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2800);
}

/* ---------- Supabase (public key only, read access is limited by your RLS policies) ---------- */
const supabaseHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  "Content-Type": "application/json"
};
async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options, headers: { ...supabaseHeaders, ...(options.headers || {}) }
  });
  const body = await response.text();
  if (!response.ok) throw new Error(body || `Supabase request failed (${response.status})`);
  return body ? JSON.parse(body) : null;
}

/* ---------- Products ---------- */
// select=* means we never assume column names: optional columns (category, stock) are used only if they exist.
function normalizeProduct(p) {
  let imgs = Array.isArray(p.images) ? p.images : (typeof p.images === "string" && p.images.trim() ? [p.images.trim()] : []);
  imgs = imgs.filter(x => typeof x === "string" && x.trim()).map(x => x.trim());
  const stock = (p.stock === null || p.stock === undefined || p.stock === "") ? null : Number(p.stock);
  return {
    id: String(p.id), name: p.name || "Product", desc: p.description || "",
    price: Number(p.price) || 0,
    images: imgs.length ? imgs : ["images/logo.jpg"],
    category: (p.category || "").toString().trim(),
    stock: Number.isFinite(stock) ? stock : null,
    created: p.created_at || ""
  };
}
const inStock = p => p.stock === null || p.stock > 0;
const productCache = new Map();
function cacheProducts(list) { list.forEach(p => productCache.set(p.id, p)); return list; }

async function fetchActiveProducts() {
  const rows = await supabaseRequest("products?select=*&is_active=eq.true&order=created_at.desc");
  return cacheProducts((rows || []).map(normalizeProduct));
}
async function fetchProductsByIds(ids) {
  ids = [...new Set(ids.map(String))].filter(i => UUID_RE.test(i));
  if (!ids.length) return [];
  const rows = await supabaseRequest(`products?select=*&is_active=eq.true&id=in.(${ids.join(",")})`);
  return cacheProducts((rows || []).map(normalizeProduct));
}
const productPage = id => `${ROOT}product.html?id=${encodeURIComponent(id)}`;
// Shareable link: /p/<id> on the live site (gives WhatsApp a photo preview). Locally it falls back to product.html.
const shareUrl = id => IS_LOCAL ? new URL(productPage(id), location.href).href : `${location.origin}/p/${encodeURIComponent(id)}`;
const waLink = text => `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`;
const waShare = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
const shareText = p => `${p.name} – ${money(p.price)}\n${shareUrl(p.id)}`;

/* ---------- Cart (same storage key as before: osb_cart) ---------- */
let cart = [];
try { cart = JSON.parse(localStorage.getItem("osb_cart") || "[]"); } catch (e) { cart = []; }
cart = (Array.isArray(cart) ? cart : []).filter(c => c && UUID_RE.test(String(c.id)) && c.size && c.qty > 0);
const saveCart = () => { try { localStorage.setItem("osb_cart", JSON.stringify(cart)); } catch (e) {} };
const cartTotal = () => cart.reduce((t, c) => { const p = productCache.get(String(c.id)); return t + (p ? p.price * c.qty : 0); }, 0);

function addToCart(id, size, qty = 1) {
  const p = productCache.get(String(id));
  if (p && !inStock(p)) { toast("Sorry, this item is out of stock"); return false; }
  const found = cart.find(c => String(c.id) === String(id) && c.size === size);
  const next = (found ? found.qty : 0) + qty;
  if (p && p.stock !== null && next > p.stock) { toast(`Only ${p.stock} left in stock`); return false; }
  if (found) found.qty = next; else cart.push({ id: String(id), size, qty });
  saveCart(); renderCart(); toast("Added to cart ✓"); return true;
}
function startCheckout(items) {
  try { localStorage.setItem("osb_checkout", JSON.stringify(items)); } catch (e) {}
  location.href = ROOT + "checkout.html";
}
const buyNow = (id, size, qty = 1) => {
  const p = productCache.get(String(id));
  if (p && !inStock(p)) return toast("Sorry, this item is out of stock");
  startCheckout([{ id: String(id), size, qty }]);
};

let cartRenderToken = 0;
async function renderCart() {
  const token = ++cartRenderToken;
  const count = $("#cartCount"); if (count) count.textContent = cart.reduce((n, c) => n + c.qty, 0);
  const box = $("#cartItems"); if (!box) return;
  if (!cart.length) { box.innerHTML = '<p class="empty">Your cart is empty</p>'; $("#cartTotal").textContent = money(0); return; }
  if (cart.some(c => !productCache.has(String(c.id)))) {
    try { await fetchProductsByIds(cart.map(c => c.id)); } catch (e) { console.warn("Cart product lookup failed:", e.message); }
    if (token !== cartRenderToken) return;
  }
  box.innerHTML = cart.map((c, i) => {
    const p = productCache.get(String(c.id));
    if (!p) return `<div class="item"><div style="flex:1"><div class="t">This item is no longer available</div><div class="qty"><button class="rm" data-a="rm" data-i="${i}">Remove</button></div></div></div>`;
    return `<div class="item"><img src="${esc(assetUrl(p.images[0]))}" alt=""><div style="flex:1">
      <div class="t">${esc(p.name)}</div><div class="s">Size: ${esc(c.size)} · ${money(p.price)}</div>
      <div class="qty"><button data-a="minus" data-i="${i}" aria-label="Less">−</button>${c.qty}<button data-a="plus" data-i="${i}" aria-label="More">+</button>
      <button class="rm" data-a="rm" data-i="${i}">Remove</button></div></div></div>`;
  }).join("");
  $("#cartTotal").textContent = money(cartTotal());
}

function mountCart() {
  const host = document.createElement("div");
  host.innerHTML = `
  <div class="overlay" id="overlay"></div>
  <aside class="cart" id="cart" aria-label="Shopping cart">
    <div class="cart-head"><h3>Your Cart</h3><button id="closeCart" aria-label="Close">✕</button></div>
    <div class="cart-items" id="cartItems"></div>
    <div class="cart-foot">
      <div class="total"><span>Total</span><strong id="cartTotal">₹0</strong></div>
      <button class="btn full" id="checkoutBtn">Checkout &amp; Pay</button>
      <p class="or">or order directly on WhatsApp</p>
      <input id="custName" placeholder="Your Name *">
      <input id="custPhone" placeholder="Your Phone Number" inputmode="tel">
      <textarea id="custAddr" rows="2" placeholder="Delivery Address *"></textarea>
      <button class="btn wa" id="orderBtn">Order on WhatsApp</button>
    </div>
  </aside>
  <div class="toast" id="toast"></div>`;
  while (host.firstChild) document.body.appendChild(host.firstChild);

  const open = o => { $("#cart").classList.toggle("open", o); $("#overlay").classList.toggle("show", o); };
  const btn = $("#openCart"); if (btn) btn.onclick = () => open(true);
  const tab = $("#tabCart"); if (tab) tab.onclick = e => { e.preventDefault(); open(true); };
  $("#closeCart").onclick = $("#overlay").onclick = () => open(false);
  mountCart.open = open;

  $("#cartItems").addEventListener("click", e => {
    const b = e.target.closest("button[data-a]"); if (!b) return;
    const i = Number(b.dataset.i); if (!cart[i]) return;
    const p = productCache.get(String(cart[i].id));
    if (b.dataset.a === "plus") {
      if (p && p.stock !== null && cart[i].qty + 1 > p.stock) return toast(`Only ${p.stock} left in stock`);
      cart[i].qty++;
    }
    if (b.dataset.a === "minus") { cart[i].qty--; if (cart[i].qty < 1) cart.splice(i, 1); }
    if (b.dataset.a === "rm") cart.splice(i, 1);
    saveCart(); renderCart();
  });
  $("#checkoutBtn").onclick = () => {
    if (!cart.length) return toast("Your cart is empty");
    startCheckout(cart.map(c => ({ id: c.id, size: c.size, qty: c.qty })));
  };
  $("#orderBtn").onclick = orderOnWhatsApp;
  renderCart();
}

/* ---------- Order API (server validates prices) with safe fallback for local/static use ---------- */
async function createOrderApi(payload) {
  let res;
  try {
    res = await fetch(ROOT + "api/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (e) { return { unavailable: true }; }
  if (!(res.headers.get("content-type") || "").includes("application/json")) return { unavailable: true };
  let data = {}; try { data = await res.json(); } catch (e) { return { unavailable: true }; }
  if (res.status >= 500) return { unavailable: true, error: data.error };
  if (!res.ok) { const err = new Error(data.error || "Could not place the order"); err.status = res.status; throw err; }
  return data;
}
// Old behaviour (direct insert from the browser). Used only when /api is not available, e.g. local testing.
async function legacyInsertOrder(c, items, total, extra = {}) {
  await supabaseRequest("orders", {
    method: "POST", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ customer_name: c.name, customer_phone: c.phone || null, customer_address: c.address, total_amount: total, items, ...extra })
  });
}
function cleanPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
}

/* ---------- "Order on WhatsApp" from the cart (existing flow, kept) ---------- */
async function orderOnWhatsApp() {
  if (!cart.length) return toast("Cart is empty");
  const name = $("#custName").value.trim(), addr = $("#custAddr").value.trim(), phone = $("#custPhone").value.trim();
  if (!name || !addr) return toast("Please enter your name and address");
  await renderCart();
  const live = cart.filter(c => productCache.has(String(c.id)));
  if (!live.length) return toast("These items are no longer available");
  const items = live.map(c => { const p = productCache.get(String(c.id)); return { product_id: p.id, product_name: p.name, size: c.size, quantity: c.qty, unit_price: p.price }; });
  let total = items.reduce((t, i) => t + i.unit_price * i.quantity, 0), ref = "", saved = false;
  const msgWindow = window.open("about:blank", "_blank");
  try {
    const r = await createOrderApi({ items: live.map(c => ({ product_id: c.id, size: c.size, quantity: c.qty })), customer: { name, phone, address: addr }, payment_method: "whatsapp" });
    if (r.unavailable) { await legacyInsertOrder({ name, phone, address: addr }, items, total); saved = true; }
    else { total = r.total; ref = r.ref; saved = true; }
  } catch (error) {
    if (error.status) { if (msgWindow) msgWindow.close(); return toast(error.message); }
    console.error("Order save failed:", error);
  }
  let msg = `*New Order – ${SHOP.name}*${ref ? ` (#${ref})` : ""}\n\n`;
  items.forEach((it, i) => { msg += `${i + 1}. ${it.product_name}\n   Size: ${it.size} | Qty: ${it.quantity} | ${SHOP.currency}${it.unit_price * it.quantity}\n`; });
  msg += `\n*Total: ${SHOP.currency}${total}*\n\n*Name:* ${name}\n`;
  if (phone) msg += `*Phone:* ${phone}\n`;
  msg += `*Address:* ${addr}`;
  const url = waLink(msg);
  if (msgWindow) msgWindow.location.href = url; else window.location.href = url;
  toast(saved ? "Order saved ✓ Opening WhatsApp" : "Opening WhatsApp (database save failed)");
}

document.addEventListener("DOMContentLoaded", () => { const y = $("#yr"); if (y) y.textContent = new Date().getFullYear(); });
mountCart();
