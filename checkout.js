/* ===== Checkout: Buy Now / cart -> order (validated on server) -> pay with PhonePe/UPI -> submit payment details ===== */
let items = [];          // [{id,size,qty}]
let order = null;        // {id, ref, total, name}
const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "") || d; } catch (e) { return d; } };
const show = id => ["stepDetails", "stepPay", "stepDone"].forEach(s => $("#" + s).hidden = s !== id);
function setStep(n) { document.querySelectorAll("#steps li").forEach(li => li.classList.toggle("on", Number(li.dataset.s) <= n)); }
const lineTotal = () => items.reduce((t, i) => { const p = productCache.get(i.id); return t + (p ? p.price * i.qty : 0); }, 0);
const deliveryCharge = () => Number(SHOP.deliveryCharge || 50);

/* ---------- Step 1: summary ---------- */
async function init() {
  items = readJson("osb_checkout", []).filter(i => i && UUID_RE.test(String(i.id)) && i.size && i.qty > 0).map(i => ({ id: String(i.id), size: String(i.size), qty: Math.min(10, Number(i.qty)) }));
  if (!items.length) {
    const last = readJson("osb_last_order", null);
    if (last && last.id) { order = last; return showPay(); }
    $("#coItems").innerHTML = '<p class="empty">Nothing to checkout yet.<br><a class="btn" href="/#shop" style="margin-top:14px">Browse the collection</a></p>';
    $("#coForm").hidden = true; return;
  }
  try { await fetchProductsByIds(items.map(i => i.id)); }
  catch (e) { $("#coItems").innerHTML = '<p class="empty">We could not load your items. Please refresh.</p>'; return; }
  renderSummary(); renderCart();
}
function renderSummary() {
  const gone = items.filter(i => !productCache.has(i.id)).length;
  items = items.filter(i => productCache.has(i.id));
  if (!items.length) { $("#coItems").innerHTML = '<p class="empty">These items are no longer available.<br><a class="btn" href="/#shop" style="margin-top:14px">Browse the collection</a></p>'; $("#coForm").hidden = true; $("#coTotal").textContent = money(0); return; }
  $("#coItems").innerHTML = (gone ? `<p class="form-msg">${gone} unavailable item${gone > 1 ? "s were" : " was"} removed.</p>` : "") + items.map((i, k) => {
    const p = productCache.get(i.id);
    const warn = !inStock(p) ? '<div class="stock out">Out of stock</div>' : (p.stock !== null && i.qty > p.stock ? `<div class="stock out">Only ${p.stock} available</div>` : "");
    return `<div class="item"><img src="${esc(assetUrl(p.images[0]))}" alt=""><div style="flex:1">
      <div class="t">${esc(p.name)}</div><div class="s">Size: ${esc(i.size)} · ${money(p.price)} each</div>${warn}
      <div class="qty"><button data-a="minus" data-k="${k}" aria-label="Less">−</button>${i.qty}<button data-a="plus" data-k="${k}" aria-label="More">+</button>
      <button class="rm" data-a="rm" data-k="${k}">Remove</button></div></div><b>${money(p.price * i.qty)}</b></div>`;
  }).join("");
  $("#coSubtotal").textContent = money(lineTotal());
  $("#coDelivery").textContent = money(deliveryCharge());
  $("#coTotal").textContent = money(lineTotal() + deliveryCharge());
  persistItems();
}
const persistItems = () => { try { localStorage.setItem("osb_checkout", JSON.stringify(items)); } catch (e) {} };
$("#coItems").addEventListener("click", e => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const k = Number(b.dataset.k), it = items[k]; if (!it) return;
  const p = productCache.get(it.id);
  if (b.dataset.a === "plus") { if (it.qty >= 10 || (p && p.stock !== null && it.qty >= p.stock)) return toast("Maximum quantity reached"); it.qty++; }
  if (b.dataset.a === "minus") { it.qty--; if (it.qty < 1) items.splice(k, 1); }
  if (b.dataset.a === "rm") items.splice(k, 1);
  renderSummary();
});

/* ---------- Place order ---------- */
$("#coForm").addEventListener("submit", async e => {
  e.preventDefault();
  if ($("#coWebsite").value) return; // spam trap
  const msg = $("#coMsg"), btn = $("#coPlace"); msg.textContent = "";
  const name = $("#coName").value.trim(), address = $("#coAddr").value.trim(), phone = cleanPhone($("#coPhone").value), pincode = $("#coPin").value.trim();
  if (!name) return msg.textContent = "Please enter your name.";
  if (!phone) return msg.textContent = "Please enter a valid 10-digit mobile number.";
  if (address.length < 10) return msg.textContent = "Please enter your full delivery address.";
  if (!/^[0-9]{6}$/.test(pincode)) return msg.textContent = "Please enter a valid 6-digit PIN code.";
  if (!items.length) return msg.textContent = "Your order is empty.";
  const method = (SHOP.upi && SHOP.upi.vpa) ? "upi" : "whatsapp";
  btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const r = await createOrderApi({ items: items.map(i => ({ product_id: i.id, size: i.size, quantity: i.qty })), customer: { name, phone, address, pincode }, payment_method: method });
    if (r.unavailable) {
      // /api not reachable (e.g. local preview): fall back to the old browser insert so nothing breaks.
      const id = crypto.randomUUID(), subtotal = lineTotal(), delivery = deliveryCharge(), total = subtotal + delivery;
      await legacyInsertOrder({ name, phone, address: `${address}, PIN: ${pincode}` }, items.map(i => { const p = productCache.get(i.id); return { product_id: p.id, product_name: p.name, size: i.size, quantity: i.qty, unit_price: p.price }; }), total, { id });
      order = { id, ref: id.slice(0, 8), subtotal, delivery, total, name, phone, address, pincode, items: items.map(i => { const p = productCache.get(i.id); return { product_name: p.name, size: i.size, quantity: i.qty, unit_price: p.price }; }) };
    } else order = { id: r.order_id, ref: r.ref, subtotal: r.subtotal, delivery: r.delivery, total: r.total, name, phone, address, pincode, items: r.items };
    order.method = method;
    try { localStorage.setItem("osb_last_order", JSON.stringify(order)); localStorage.removeItem("osb_checkout"); } catch (err) {}
    // remove the purchased lines from the cart
    cart = cart.filter(c => !items.some(i => i.id === String(c.id) && i.size === c.size)); saveCart();
    showPay();
  } catch (err) {
    msg.textContent = err.message || "Could not place the order. Please try again.";
  } finally { btn.disabled = false; btn.textContent = "Place order & pay"; }
});

/* ---------- Step 2: pay ---------- */
function upiQuery() {
  const u = SHOP.upi;
  return `pa=${encodeURIComponent(u.vpa)}&pn=${encodeURIComponent(u.name || SHOP.name)}&am=${Number(order.total).toFixed(2)}&cu=INR&tn=${encodeURIComponent("Order " + order.ref)}&tr=${encodeURIComponent(order.ref)}`;
}
const orderMsg = extra => {
  const lines = (order.items || []).map((it, i) => `${i + 1}. ${it.product_name} | Size: ${it.size} | Qty: ${it.quantity} | ${money(Number(it.unit_price) * Number(it.quantity))}`).join("\n");
  return `*${SHOP.name} – Order #${order.ref}*\n${lines}\nSubtotal: ${money(order.subtotal ?? order.total)}\nDelivery: ${money(order.delivery || 0)}\n*Grand total: ${money(order.total)}*\nCustomer: ${order.name || ""}\nMobile: ${order.phone || ""}\nAddress: ${order.address || ""}\nPIN: ${order.pincode || ""}\nPayment status: *PENDING – awaiting store verification*\n${extra || ""}`.trim();
};
function showPay() {
  setStep(2); show("stepPay");
  $("#payAmount").textContent = money(order.total); $("#payRef").textContent = "#" + order.ref;
  const hasUpi = SHOP.upi && SHOP.upi.vpa;
  if (hasUpi) {
    const q = upiQuery(), mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    $("#payButtons").innerHTML = `<a class="btn full phonepe" href="upi://pay?${q}">Pay with UPI app</a>
      ${mobile ? "" : '<p class="note">On a computer? Open this page on your phone, or pay to the UPI ID below from any UPI app.</p>'}`;
    $("#vpaBox").hidden = false; $("#vpaText").textContent = SHOP.upi.vpa;
  } else {
    $("#payButtons").innerHTML = `<p>Tap below and we will send you the PhonePe payment details on WhatsApp.</p>
      <a class="btn wa" target="_blank" rel="noopener" href="${esc(waLink(orderMsg("Please share the payment details.")))}" style="display:block;text-align:center;margin-top:10px">Get payment details on WhatsApp</a>`;
  }
}
$("#copyVpa").onclick = async () => { try { await navigator.clipboard.writeText(SHOP.upi.vpa); toast("UPI ID copied ✓"); } catch (e) { toast(SHOP.upi.vpa); } };

/* ---------- Payment details: UTR + optional screenshot ---------- */
async function uploadProof(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) throw new Error("bad-file");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${order.id}/${Date.now()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/payment-proofs/${path}`, {
    method: "POST", headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": file.type, "x-upsert": "false" }, body: file
  });
  if (!res.ok) throw new Error("upload-failed");
  return path;
}
$("#paySubmit").onclick = async () => {
  const msg = $("#payMsg"), btn = $("#paySubmit"), utr = $("#payUtr").value.trim().replace(/\s+/g, ""), file = $("#payShot").files[0];
  msg.textContent = "";
  if (!/^[A-Za-z0-9]{8,35}$/.test(utr)) return msg.textContent = "Please enter the transaction ID (UTR) shown in your payment app.";
  const waWindow = window.open("about:blank", "_blank");
  btn.disabled = true; btn.textContent = "Submitting…";
  let proof = null, recorded = false;
  try { proof = await uploadProof(file); } catch (e) { console.warn("Screenshot not stored:", e.message); }
  try { recorded = (await supabaseRequest("rpc/submit_payment_proof", { method: "POST", body: JSON.stringify({ p_order_id: order.id, p_utr: utr, p_proof_path: proof }) })) === true; }
  catch (e) { console.warn("Payment details not recorded online:", e.message); }
  btn.disabled = false; btn.textContent = "Submit payment details";
  finish(recorded, utr, !!file && !proof, waWindow);
};
$("#payWa").onclick = async () => {
  const utr = $("#payUtr").value.trim(), file = $("#payShot").files[0];
  const text = orderMsg(`*Payment proof*\nUTR: ${utr || "(will send)"}\nScreenshot attached.`);
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  window.open(waLink(text), "_blank");
  toast("Attach your payment screenshot in the WhatsApp chat");
};

/* ---------- Step 3 ---------- */
function finish(recorded, utr, shotMissing, waWindow) {
  setStep(3); show("stepDone");
  try { localStorage.removeItem("osb_last_order"); } catch (e) {}
  $("#doneTitle").textContent = recorded ? "Payment details received" : "Order received";
  $("#doneText").innerHTML = recorded
    ? `Thank you! Order <b>#${esc(order.ref)}</b> is now <b>waiting for payment verification</b>. We will confirm it after checking our PhonePe merchant account.${shotMissing ? " Your screenshot could not be uploaded, so please also send it on WhatsApp." : ""}`
    : `Order <b>#${esc(order.ref)}</b> is saved, but we could not record your payment details online. Please send your transaction ID and screenshot on WhatsApp so we can verify it.`;
  $("#doneWa").href = waLink(orderMsg(`Customer-reported UTR: ${utr || "Not provided"}. Payment is NOT verified; please check bank/UPI statement.`));
  $("#doneWa").textContent = "Send complete order to WhatsApp";
  if (waWindow) waWindow.location.href = $("#doneWa").href;
}
init();
