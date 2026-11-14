/*
 * GET /p/<product-id>  (rewritten to /api/p?id=<product-id> in vercel.json)
 * Serves product.html with product-specific Open Graph tags so a shared link shows the photo,
 * name and price in WhatsApp / Facebook / Telegram previews. Visitors get the normal product page.
 */
const DEFAULT_URL = "https://ecglfrrxjkbbhuslgzcf.supabase.co";
const DEFAULT_KEY = "sb_publishable_UanhHKQVHsX80fVtTX1o_g_AJ1Qjz9G";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function firstImage(p, origin) {
  let img = Array.isArray(p.images) ? p.images.find(x => typeof x === "string" && x.trim()) : (typeof p.images === "string" ? p.images : "");
  img = (img || "images/logo.jpg").trim();
  return /^https?:\/\//i.test(img) ? img : `${origin}/${img.replace(/^\/+/, "")}`;
}
function metaFor(p, origin, id) {
  const url = `${origin}/p/${id}`;
  const title = `${p.name} – ₹${Number(p.price).toLocaleString("en-IN")} | Oo_Sathyabhama`;
  const desc = (p.description || "Kurta sets and dresses from Oo_Sathyabhama. Choose your size and order online.").replace(/\s+/g, " ").slice(0, 200);
  const image = firstImage(p, origin);
  const inStock = p.stock === null || p.stock === undefined || p.stock === "" || Number(p.stock) > 0;
  const ld = { "@context": "https://schema.org", "@type": "Product", name: p.name, image: [image], description: desc,
    offers: { "@type": "Offer", priceCurrency: "INR", price: Number(p.price), url, availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" } };
  return { title, tags: `
  <link rel="canonical" href="${esc(url)}">
  <meta name="description" content="${esc(desc)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Oo_Sathyabhama">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="product:price:amount" content="${esc(Number(p.price))}">
  <meta property="product:price:currency" content="INR">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` };
}

module.exports = async function handler(req, res) {
  const id = String((req.query && req.query.id) || "").trim();
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
  const origin = `${proto}://${host}`;
  const url = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

  let page = "";
  try { const r = await fetch(`${origin}/product.html`); if (r.ok) page = await r.text(); } catch (e) { /* use fallback below */ }
  if (!page) page = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oo_Sathyabhama</title><!--OG--></head><body><script>location.replace("/product.html?id=${encodeURIComponent(id)}")</script><noscript><a href="/">Open the shop</a></noscript></body></html>`;

  let meta = null;
  if (UUID_RE.test(id)) {
    try {
      const r = await fetch(`${url}/rest/v1/products?select=*&is_active=eq.true&id=eq.${id.toLowerCase()}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (r.ok) { const rows = await r.json(); if (rows[0]) meta = metaFor(rows[0], origin, id.toLowerCase()); }
    } catch (e) { /* page still works without preview tags */ }
  }
  if (meta) {
    page = page.replace(/<title>[^<]*<\/title>/i, `<title>${esc(meta.title)}</title>`).replace("<!--OG-->", meta.tags);
  } else {
    page = page.replace("<!--OG-->", '<meta name="robots" content="noindex">');
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", meta ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store");
  res.end(page);
};
