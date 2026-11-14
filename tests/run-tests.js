// Run with:  node tests/run-tests.js      (Node 18+; no packages needed)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");

const PID = "11111111-1111-4111-8111-111111111111", PID2 = "22222222-2222-4222-8222-222222222222";
const mkRes = () => { const r = { headers: {}, statusCode: 0, body: "" }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.end = b => { r.body = b; }; return r; };
const json = r => JSON.parse(r.body);
function mockFetch(handler) { const calls = []; global.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); const out = await handler(String(url), opts); return { ok: out.status < 400, status: out.status, headers: { get: () => out.ct || "application/json" }, json: async () => out.body, text: async () => (typeof out.body === "string" ? out.body : JSON.stringify(out.body)) }; }; return calls; }
const product = (over = {}) => ({ id: PID, name: "Royal Blue Kurta Set", price: 1150, is_active: true, images: ["https://x.supabase.co/storage/v1/object/public/products/a.jpg"], description: "Cotton", ...over });
const order = (items, extra = {}) => ({ method: "POST", body: { items, customer: { name: "Asha", phone: "9876543210", address: "12 Main Road, Hyderabad", pincode: "500001" }, payment_method: "upi", ...extra } });
const create = require("../api/create-order.js");

test("create-order: price comes from the database, never from the browser", async () => {
  const calls = mockFetch(async (url) => url.includes("/products?") ? { status: 200, body: [product()] } : { status: 201, body: "" });
  const res = mkRes();
  await create(order([{ product_id: PID, size: "m", quantity: 2, unit_price: 1, price: 1 }], { total: 1, total_amount: 1 }), res);
  assert.equal(res.statusCode, 201);
  const out = json(res); assert.equal(out.subtotal, 2300); assert.equal(out.delivery, 50); assert.equal(out.total, 2350); assert.equal(out.ref.length, 8);
  const ins = calls.find(c => c.url.endsWith("/orders")); const sent = JSON.parse(ins.opts.body);
  assert.equal(sent.total_amount, 2350); assert.match(sent.customer_address, /PIN: 500001/); assert.equal(sent.status, "pending"); assert.equal(sent.items[0].unit_price, 1150);
  assert.equal(sent.items[0].size, "M"); assert.equal(sent.payment_method, "upi"); assert.equal(sent.id, out.order_id);
});
test("create-order: rejects GET, empty cart, bad size/qty/product id", async () => {
  mockFetch(async () => ({ status: 200, body: [product()] }));
  let r = mkRes(); await create({ method: "GET" }, r); assert.equal(r.statusCode, 405);
  for (const bad of [[], [{ product_id: PID, size: "M", quantity: 0 }], [{ product_id: PID, size: "M", quantity: 99 }], [{ product_id: PID, size: "<b>", quantity: 1 }], [{ product_id: "1", size: "M", quantity: 1 }]]) {
    r = mkRes(); await create(order(bad), r); assert.equal(r.statusCode, 400, JSON.stringify(bad));
  }
  r = mkRes(); await create({ method: "POST", body: { items: [{ product_id: PID, size: "M", quantity: 1 }], customer: { name: "", address: "x" } } }, r); assert.equal(r.statusCode, 400);
});
test("create-order: hidden / deleted products are refused", async () => {
  mockFetch(async () => ({ status: 200, body: [] }));
  const r = mkRes(); await create(order([{ product_id: PID, size: "M", quantity: 1 }]), r); assert.equal(r.statusCode, 409);
});
test("create-order: stock is enforced when tracked, ignored when not tracked", async () => {
  for (const [stock, qty, expect] of [[1, 2, 409], [0, 1, 409], [5, 2, 201], [null, 3, 201]]) {
    mockFetch(async (url) => url.includes("/products?") ? { status: 200, body: [product({ stock })] } : { status: 201, body: "" });
    const r = mkRes(); await create(order([{ product_id: PID, size: "L", quantity: qty }]), r); assert.equal(r.statusCode, expect, `stock=${stock} qty=${qty}`);
  }
});
test("create-order: same product in two sizes counts against one stock pool; duplicates merge", async () => {
  mockFetch(async (url) => url.includes("/products?") ? { status: 200, body: [product({ stock: 3 })] } : { status: 201, body: "" });
  let r = mkRes(); await create(order([{ product_id: PID, size: "M", quantity: 2 }, { product_id: PID, size: "L", quantity: 2 }]), r); assert.equal(r.statusCode, 409);
  const calls = mockFetch(async (url) => url.includes("/products?") ? { status: 200, body: [product()] } : { status: 201, body: "" });
  r = mkRes(); await create(order([{ product_id: PID, size: "M", quantity: 1 }, { product_id: PID, size: "m", quantity: 2 }]), r);
  assert.equal(json(r).total, 3500); assert.equal(JSON.parse(calls.find(c => c.url.endsWith("/orders")).opts.body).items.length, 1);
});
test("create-order: works before ecommerce-upgrade.sql is run (retries without payment columns)", async () => {
  let n = 0;
  const calls = mockFetch(async (url) => { if (url.includes("/products?")) return { status: 200, body: [product()] }; n++; return n === 1 ? { status: 400, body: '{"message":"Could not find the \'payment_method\' column of \'orders\' in the schema cache"}' } : { status: 201, body: "" }; });
  const r = mkRes(); await create(order([{ product_id: PID, size: "M", quantity: 1 }]), r); assert.equal(r.statusCode, 201);
  const second = JSON.parse(calls.filter(c => c.url.endsWith("/orders"))[1].opts.body); assert.equal("payment_method" in second, false);
});
test("create-order: other database errors return a generic 502 (no internals leaked)", async () => {
  mockFetch(async (url) => url.includes("/products?") ? { status: 200, body: [product()] } : { status: 403, body: "new row violates row-level security policy for table orders" });
  const r = mkRes(); await create(order([{ product_id: PID, size: "M", quantity: 1 }]), r);
  assert.equal(r.statusCode, 502); assert.ok(!r.body.includes("row-level"));
});
test("create-order: service-role key (if configured) is used only for writing orders", async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "SERVICE_SECRET";
  const calls = mockFetch(async (url) => url.includes("/products?") ? { status: 200, body: [product()] } : { status: 201, body: "" });
  const r = mkRes(); await create(order([{ product_id: PID, size: "M", quantity: 1 }]), r); delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal(calls.find(c => c.url.includes("/products?")).opts.headers.apikey.includes("SERVICE"), false);
  assert.equal(calls.find(c => c.url.endsWith("/orders")).opts.headers.apikey, "SERVICE_SECRET");
  assert.ok(!r.body.includes("SERVICE_SECRET"));
});

const og = require("../api/p.js");
const html = "<html><head><title>Product | Oo_Sathyabhama</title>\n<!--OG-->\n</head><body>page</body></html>";
const ogReq = id => ({ query: { id }, headers: { host: "shop.example.com", "x-forwarded-proto": "https" } });
test("share page: injects photo/name/price preview tags; escapes hostile text", async () => {
  mockFetch(async (url) => url.endsWith("/product.html") ? { status: 200, ct: "text/html", body: html } : { status: 200, body: [product({ name: 'Evil "><script>alert(1)</script>', images: ["images/dress1.jpg"] })] });
  const r = mkRes(); await og(ogReq(PID), r);
  assert.equal(r.statusCode, 200); assert.ok(r.body.includes('property="og:image" content="https://shop.example.com/images/dress1.jpg"'));
  assert.ok(r.body.includes("₹1,150")); assert.ok(r.body.includes(`https://shop.example.com/p/${PID}`));
  assert.ok(!r.body.includes("<script>alert(1)</script>")); assert.ok(r.body.includes("page</body>"));
});
test("share page: unknown id still serves the page (noindex), invalid id never hits the database", async () => {
  const calls = mockFetch(async (url) => url.endsWith("/product.html") ? { status: 200, ct: "text/html", body: html } : { status: 200, body: [] });
  let r = mkRes(); await og(ogReq("not-a-uuid"), r); assert.ok(r.body.includes("noindex")); assert.equal(calls.some(c => c.url.includes("/rest/v1/")), false);
  r = mkRes(); await og(ogReq(PID2), r); assert.ok(r.body.includes("noindex"));
});
test("share page: falls back to a redirect page if product.html cannot be fetched", async () => {
  mockFetch(async (url) => { if (url.endsWith("/product.html")) throw new Error("blocked"); return { status: 200, body: [product()] }; });
  const r = mkRes(); await og(ogReq(PID), r); assert.ok(r.body.includes("location.replace")); assert.ok(r.body.includes("og:title"));
});

/* ---------- storefront helpers (common.js) in a stub browser ---------- */
function loadCommon(fetchImpl) {
  const el = () => { const e = { classList: { toggle() {}, add() {}, remove() {} }, dataset: {}, style: {}, addEventListener() {}, appendChild() {}, firstChild: null, innerHTML: "", textContent: "", value: "" }; return e; };
  const store = {}; const doc = { documentElement: { dataset: { root: "/" } }, querySelector: () => el(), createElement: () => el(), body: { appendChild() {} }, addEventListener() {} };
  const ctx = { document: doc, location: { protocol: "https:", hostname: "shop.example.com", origin: "https://shop.example.com", href: "https://shop.example.com/" }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, fetch: fetchImpl, console, setTimeout, clearTimeout, URL, encodeURIComponent, Number, JSON, Map, Set, window: { open() {} }, crypto: require("crypto"), navigator: {} };
  ctx.window.location = ctx.location; vm.createContext(ctx);
  const src = ["supabase-config.js", "products.js", "common.js"].map(f => fs.readFileSync(path.join(root, f), "utf8")).join("\n") +
    "\n;globalThis.T={normalizeProduct,cleanPhone,inStock,addToCart,shareUrl,productPage,fetchActiveProducts,createOrderApi,getCart:()=>cart,cache:productCache,cacheProducts};";
  vm.runInContext(src, ctx); return ctx.T;
}
test("storefront: product normalisation, optional columns and share URLs", () => {
  const T = loadCommon(async () => ({}));
  const p = T.normalizeProduct({ id: PID, name: "A", price: "1150", images: ["a.jpg", "", "b.jpg"], is_active: true });
  assert.deepEqual(p.images, ["a.jpg", "b.jpg"]); assert.equal(p.price, 1150); assert.equal(p.stock, null); assert.equal(p.category, ""); assert.equal(T.inStock(p), true);
  assert.equal(T.inStock(T.normalizeProduct({ id: PID, price: 1, stock: 0 })), false);
  assert.equal(T.normalizeProduct({ id: PID, price: 1, images: "single.jpg" }).images[0], "single.jpg");
  assert.equal(T.normalizeProduct({ id: PID, price: 1, images: null }).images[0], "images/logo.jpg");
  assert.equal(T.shareUrl(PID), `https://shop.example.com/p/${PID}`);
});
test("storefront: phone validation", () => {
  const T = loadCommon(async () => ({}));
  for (const [v, ok] of [["9392271439", true], ["+91 93922 71439", true], ["09392271439", true], ["12345", false], ["5392271439", false], ["", false]]) assert.equal(!!T.cleanPhone(v), ok, v);
});
test("storefront: cart respects stock and out-of-stock", () => {
  const T = loadCommon(async () => ({ ok: true, text: async () => "[]" }));
  T.cacheProducts([T.normalizeProduct({ id: PID, price: 1150, stock: 2 }), T.normalizeProduct({ id: PID2, price: 900, stock: 0 })]);
  assert.equal(T.addToCart(PID, "M", 1), true); assert.equal(T.addToCart(PID, "M", 1), true); assert.equal(T.addToCart(PID, "M", 1), false);
  assert.equal(T.addToCart(PID2, "M", 1), false); assert.equal(T.getCart().length, 1);
});
test("storefront: reads live products with select=* and only active ones (no assumed columns)", async () => {
  let seen = ""; const T = loadCommon(async url => { seen = url; return { ok: true, text: async () => JSON.stringify([{ id: PID, name: "A", price: 1, images: [] }]) }; });
  const list = await T.fetchActiveProducts(); assert.equal(list.length, 1);
  assert.ok(seen.includes("select=*") && seen.includes("is_active=eq.true"));
});
test("storefront: order API falls back safely when /api is missing, surfaces real errors", async () => {
  let T = loadCommon(async () => ({ ok: false, status: 404, headers: { get: () => "text/html" }, json: async () => { throw 1; } }));
  assert.equal((await T.createOrderApi({})).unavailable, true);
  T = loadCommon(async () => ({ ok: false, status: 409, headers: { get: () => "application/json" }, json: async () => ({ error: "Only 1 left" }) }));
  await assert.rejects(() => T.createOrderApi({}), /Only 1 left/);
});
