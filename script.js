/* ===== Home page: product grid, search, categories, sorting ===== */
let allProducts = [], activeCat = "All", query = "", sortMode = "new";
const selected = {};

async function loadProducts() {
  try {
    allProducts = await fetchActiveProducts();
    if (!allProducts.length && SHOP.useDemoFallback) {
      allProducts = cacheProducts(PRODUCTS.map(p => normalizeProduct({ id: p.id, name: p.name, description: p.desc, price: p.price, images: [p.image] })));
    }
  } catch (error) {
    console.warn("Could not load products:", error.message);
    if (SHOP.useDemoFallback) {
      allProducts = cacheProducts(PRODUCTS.map(p => normalizeProduct({ id: p.id, name: p.name, description: p.desc, price: p.price, images: [p.image] })));
    } else {
      $("#grid").innerHTML = '<p class="empty">We could not load the collection right now.<br><button class="btn" id="retry" style="margin-top:14px">Try again</button></p>';
      $("#retry").onclick = () => { $("#grid").innerHTML = '<p class="empty">Loading collection…</p>'; loadProducts(); };
      return;
    }
  }
  renderChips(); renderProducts(); renderCart();
}

function renderChips() {
  const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
  const show = cats.length >= 2 || (cats.length === 1 && allProducts.some(p => !p.category));
  const box = $("#chips"); box.hidden = !show;
  if (!show) { activeCat = "All"; return; }
  if (activeCat !== "All" && !cats.includes(activeCat)) activeCat = "All";
  box.innerHTML = ["All", ...cats].map(c => `<button class="chip${c === activeCat ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

function visibleProducts() {
  const q = query.trim().toLowerCase();
  let list = allProducts.filter(p => (activeCat === "All" || p.category === activeCat) &&
    (!q || `${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q)));
  if (sortMode === "low") list.sort((a, b) => a.price - b.price);
  else if (sortMode === "high") list.sort((a, b) => b.price - a.price);
  return list; // "new" keeps the database order (newest first)
}

function renderProducts() {
  const list = visibleProducts();
  $("#resultCount").textContent = allProducts.length ? `${list.length} item${list.length === 1 ? "" : "s"}` : "";
  if (!allProducts.length) { $("#grid").innerHTML = '<p class="empty">No products available right now. Please check back soon.</p>'; return; }
  if (!list.length) { $("#grid").innerHTML = '<p class="empty">No products match your search.</p>'; return; }
  $("#grid").innerHTML = list.map(p => {
    const ok = inStock(p), dis = ok ? "" : " disabled";
    const badge = !ok ? '<span class="badge out">Out of stock</span>' : (p.stock !== null && p.stock <= 3 ? `<span class="badge low">Only ${p.stock} left</span>` : "");
    return `<div class="card${ok ? "" : " soldout"}">
      <a class="imgwrap" href="${esc(productPage(p.id))}"><img src="${esc(assetUrl(p.images[0]))}" alt="${esc(p.name)}" loading="lazy">${badge}</a>
      <div class="info"><h3><a href="${esc(productPage(p.id))}">${esc(p.name)}</a></h3><p class="d">${esc(p.desc)}</p>
        <div class="price">${money(p.price)}</div>
        <div class="sizes" data-id="${esc(p.id)}">${SHOP.sizes.map(s => `<button class="size${selected[p.id] === s ? " active" : ""}" data-size="${esc(s)}"${dis}>${esc(s)}</button>`).join("")}</div>
        <div class="btn-row"><button class="add" data-id="${esc(p.id)}"${dis}>Add to Cart</button><button class="buy" data-id="${esc(p.id)}"${dis}>Buy Now</button></div>
      </div></div>`;
  }).join("");
}

$("#grid").addEventListener("click", e => {
  const sz = e.target.closest(".size");
  if (sz) {
    const wrap = sz.parentElement;
    wrap.querySelectorAll(".size").forEach(b => b.classList.remove("active"));
    sz.classList.add("active"); selected[wrap.dataset.id] = sz.dataset.size; return;
  }
  const add = e.target.closest(".add"), buy = e.target.closest(".buy");
  const btn = add || buy; if (!btn) return;
  const id = btn.dataset.id;
  if (!selected[id]) { toast("Please select a size first"); return; }
  if (add) addToCart(id, selected[id]); else buyNow(id, selected[id]);
});
$("#chips").addEventListener("click", e => {
  const c = e.target.closest(".chip"); if (!c) return;
  activeCat = c.dataset.cat; renderChips(); renderProducts();
});
$("#search").addEventListener("input", e => { query = e.target.value; renderProducts(); });
$("#sort").addEventListener("change", e => { sortMode = e.target.value; renderProducts(); });

loadProducts();
