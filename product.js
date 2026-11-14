/* ===== Product detail page (/p/<id> or product.html?id=<id>) ===== */
const pid = (location.pathname.match(/\/p\/([^/?#]+)/) || [])[1] || new URLSearchParams(location.search).get("id") || "";
let current = null, chosenSize = "", qty = 1, imgIndex = 0;

function notFound(msg) {
  $("#pd").innerHTML = `<div class="empty"><h3>${esc(msg || "This product is not available")}</h3><p>It may have been removed or sold out.</p><a class="btn" href="${ROOT}#shop" style="margin-top:14px">Back to shop</a></div>`;
}

async function init() {
  if (!UUID_RE.test(pid)) return notFound("Product not found");
  let p;
  try { [p] = await fetchProductsByIds([pid]); }
  catch (e) { return notFound("We could not load this product right now"); }
  if (!p) return notFound("Product not found");
  current = p;
  document.title = `${p.name} | ${SHOP.name}`;
  $("#crumbName").textContent = p.name;
  if (!IS_LOCAL && !location.pathname.startsWith("/p/")) history.replaceState(null, "", `/p/${encodeURIComponent(pid)}`);
  render(); renderCart(); loadRelated();
}

function render() {
  const p = current, ok = inStock(p);
  const stockLine = !ok ? '<p class="stock out">Out of stock</p>'
    : (p.stock !== null && p.stock <= 5 ? `<p class="stock low">Only ${p.stock} left</p>` : '<p class="stock in">In stock</p>');
  const thumbs = p.images.length > 1 ? `<div class="thumbs">${p.images.map((src, i) =>
    `<button class="thumb${i === imgIndex ? " active" : ""}" data-i="${i}" aria-label="Image ${i + 1}"><img src="${esc(assetUrl(src))}" alt="" loading="lazy"></button>`).join("")}</div>` : "";
  $("#pd").innerHTML = `
    <div class="gallery">
      <div class="main-img"><img id="mainImg" src="${esc(assetUrl(p.images[imgIndex]))}" alt="${esc(p.name)}">
        ${p.images.length > 1 ? '<button class="nav-arrow prev" data-d="-1" aria-label="Previous image">‹</button><button class="nav-arrow next" data-d="1" aria-label="Next image">›</button>' : ""}
      </div>${thumbs}
    </div>
    <div class="pd-info">
      ${p.category ? `<p class="tag">${esc(p.category)}</p>` : ""}
      <h1>${esc(p.name)}</h1>
      <div class="price big">${money(p.price)}</div>
      ${stockLine}
      ${p.desc ? `<p class="pd-desc">${esc(p.desc)}</p>` : ""}
      <div class="label">Select size</div>
      <div class="sizes" id="sizes">${SHOP.sizes.map(s => `<button class="size${chosenSize === s ? " active" : ""}" data-size="${esc(s)}"${ok ? "" : " disabled"}>${esc(s)}</button>`).join("")}</div>
      <div class="label">Quantity</div>
      <div class="qty-pick"><button id="qMinus" aria-label="Less">−</button><span id="qVal">${qty}</span><button id="qPlus" aria-label="More">+</button></div>
      <div class="pd-actions">
        <button class="btn buy-now" id="buyNow"${ok ? "" : " disabled"}>Buy Now</button>
        <button class="btn ghost" id="addCart"${ok ? "" : " disabled"}>Add to Cart</button>
      </div>
      <div class="pd-links">
        <a class="wa-btn" id="shareWa" target="_blank" rel="noopener" href="${esc(waShare(shareText(p)))}">📤 Share on WhatsApp</a>
        <a class="wa-btn alt" target="_blank" rel="noopener" href="${esc(waLink(`Hi, I have a question about ${p.name} (${shareUrl(p.id)})`))}">💬 Ask about this item</a>
        <button class="linkbtn" id="copyLink">🔗 Copy link</button>
      </div>
      <ul class="pd-notes"><li>Pay securely with PhonePe / UPI, or order on WhatsApp.</li><li>Your order is confirmed once we verify the payment.</li></ul>
    </div>`;
}

function setImage(i) {
  const n = current.images.length; imgIndex = (i + n) % n;
  $("#mainImg").src = assetUrl(current.images[imgIndex]);
  document.querySelectorAll(".thumb").forEach((t, k) => t.classList.toggle("active", k === imgIndex));
}
const maxQty = () => Math.min(10, current.stock === null ? 10 : Math.max(current.stock, 1));
function needSize() { if (!chosenSize) { toast("Please select a size first"); return true; } return false; }

$("#pd").addEventListener("click", async e => {
  if (!current) return;
  const t = e.target.closest("button"); if (!t) return;
  if (t.classList.contains("thumb")) return setImage(Number(t.dataset.i));
  if (t.classList.contains("nav-arrow")) return setImage(imgIndex + Number(t.dataset.d));
  if (t.classList.contains("size")) {
    chosenSize = t.dataset.size;
    document.querySelectorAll("#sizes .size").forEach(b => b.classList.toggle("active", b === t)); return;
  }
  if (t.id === "qMinus") { qty = Math.max(1, qty - 1); $("#qVal").textContent = qty; return; }
  if (t.id === "qPlus") { if (qty >= maxQty()) return toast(current.stock !== null ? `Only ${current.stock} in stock` : "Maximum 10 per order"); qty++; $("#qVal").textContent = qty; return; }
  if (t.id === "addCart") { if (!needSize()) addToCart(current.id, chosenSize, qty); return; }
  if (t.id === "buyNow") { if (!needSize()) buyNow(current.id, chosenSize, qty); return; }
  if (t.id === "copyLink") {
    const url = shareUrl(current.id);
    try { await navigator.clipboard.writeText(url); toast("Link copied ✓"); } catch (err) { prompt("Copy this link:", url); }
  }
});
// swipe on the main image (mobile)
let sx = null;
$("#pd").addEventListener("touchstart", e => { sx = e.target.closest(".main-img") ? e.touches[0].clientX : null; }, { passive: true });
$("#pd").addEventListener("touchend", e => {
  if (sx === null || !current || current.images.length < 2) return;
  const dx = e.changedTouches[0].clientX - sx; sx = null;
  if (Math.abs(dx) > 40) setImage(imgIndex + (dx < 0 ? 1 : -1));
}, { passive: true });

async function loadRelated() {
  try {
    const all = (await fetchActiveProducts()).filter(p => p.id !== current.id);
    all.sort((a, b) => (b.category === current.category) - (a.category === current.category));
    const list = all.slice(0, 4); if (!list.length) return;
    $("#relatedGrid").innerHTML = list.map(p => `<div class="card"><a class="imgwrap" href="${esc(productPage(p.id))}"><img src="${esc(assetUrl(p.images[0]))}" alt="${esc(p.name)}" loading="lazy"></a>
      <div class="info"><h3><a href="${esc(productPage(p.id))}">${esc(p.name)}</a></h3><div class="price">${money(p.price)}</div></div></div>`).join("");
    $("#related").hidden = false;
  } catch (e) { /* related items are optional */ }
}
init();
