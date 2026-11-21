// Razorpay checkout logic (ported 1:1 from the former Firebase Cloud Function so behaviour is unchanged).
// Dependencies are injected so the logic can be tested without Firebase or Razorpay.
import crypto from 'node:crypto';
import { httpError } from './errors.js';

const MOBILE = /^[6-9]\d{9}$/;
const equalHex = (a, b) => { try { const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex'); return x.length === y.length && crypto.timingSafeEqual(x, y); } catch { return false; } };
const qtyFor = (items, id) => items.filter((x) => x.productId === id).reduce((n, x) => n + x.quantity, 0);

export function createPaymentService({ db, FieldValue, rp, env }) {
  const now = () => FieldValue.serverTimestamp();

  async function createOrder(body) {
    const { items, customer } = body || {};
    if (!Array.isArray(items) || !items.length || items.length > 30) throw httpError(400, 'Your cart is empty or invalid.');
    if (!customer || typeof customer.fullName !== 'string' || customer.fullName.trim().length < 2 || !MOBILE.test(customer.mobile || '') || typeof customer.address !== 'string' || !customer.address.trim() || !customer.city || !customer.state || !/^[0-9]{6}$/.test(customer.pincode || '')) throw httpError(400, 'Please provide valid delivery details.');
    const merged = new Map();
    for (const x of items) {
      if (typeof x.productId !== 'string' || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 10) throw httpError(400, 'Invalid cart item.');
      const k = `${x.productId}|${x.size || ''}|${x.color || ''}`;
      const old = merged.get(k);
      merged.set(k, { productId: x.productId, quantity: (old?.quantity || 0) + x.quantity, size: String(x.size || ''), color: String(x.color || '') });
    }
    const settingsSnap = await db.doc('settings/store').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    let subtotal = 0;
    const lines = [];
    const qtyById = new Map();
    for (const item of merged.values()) {
      const snap = await db.doc(`products/${item.productId}`).get();
      if (!snap.exists) throw httpError(409, 'A product in your bag is unavailable.');
      const p = snap.data();
      if (p.active === false || !Number.isFinite(p.price) || p.price <= 0) throw httpError(409, 'A product is unavailable.');
      qtyById.set(item.productId, (qtyById.get(item.productId) || 0) + item.quantity);
      if (Number(p.stock || 0) < qtyById.get(item.productId)) throw httpError(409, `${p.name} has insufficient stock.`);
      if (Array.isArray(p.sizes) && !p.sizes.includes(item.size)) throw httpError(409, 'Selected size is unavailable.');
      if (Array.isArray(p.colors) && p.colors.length && !p.colors.includes(item.color)) throw httpError(409, 'Selected colour is unavailable.');
      const lineTotal = Number((p.price * item.quantity).toFixed(2));
      subtotal += lineTotal;
      lines.push({ productId: item.productId, name: p.name, sku: p.sku || '', price: Number(p.price), quantity: item.quantity, size: item.size, color: item.color, image: p.images?.[0]?.url || p.images?.[0] || '', lineTotal });
    }
    const shipping = Number(settings.freeShippingThreshold) > 0 && subtotal >= Number(settings.freeShippingThreshold) ? 0 : Number(settings.shippingCharges || 0);
    const total = Number((subtotal + shipping).toFixed(2));
    const amountPaise = Math.round(total * 100);
    if (!Number.isSafeInteger(amountPaise) || total <= 0) throw httpError(400, 'Invalid payable amount.');
    const ro = await rp.createOrder({ amount: amountPaise, currency: 'INR', receipt: `oosa_${Date.now()}`, notes: { store: 'Oosatyabhama' } });
    const attempt = db.collection('paymentAttempts').doc();
    await attempt.set({
      razorpayOrderId: ro.id, items: lines,
      customer: { fullName: customer.fullName.trim(), mobile: customer.mobile, email: String(customer.email || '').trim(), address: customer.address.trim(), city: String(customer.city).trim(), state: String(customer.state).trim(), pincode: customer.pincode },
      subtotal, shipping, total, amountPaise, status: 'Created', createdAt: now(),
    });
    return { status: 200, body: { keyId: env.RAZORPAY_KEY_ID, razorpayOrderId: ro.id, amount: ro.amount, currency: ro.currency, attemptId: attempt.id } };
  }

  async function finalize(attemptId, paymentId, orderId) {
    const ar = db.doc(`paymentAttempts/${attemptId}`);
    return db.runTransaction(async (tx) => {
      const a = await tx.get(ar);
      if (!a.exists) throw Error('Payment attempt not found.');
      const d = a.data();
      if (d.razorpayOrderId !== orderId) throw Error('Payment order mismatch.');
      if (d.orderId) return { orderId: d.orderId, alreadyProcessed: true };
      if (d.status === 'Failed') throw Error('Payment attempt is marked failed.');
      const ids = [...new Set(d.items.map((x) => x.productId))];
      const products = new Map();
      for (const id of ids) {
        const s = await tx.get(db.doc(`products/${id}`));
        if (!s.exists) throw Error('Product no longer exists.');
        products.set(id, s.data());
      }
      for (const id of ids) {
        const p = products.get(id);
        if (p.active === false || Number(p.stock || 0) < qtyFor(d.items, id)) throw Error('Stock changed while payment was processing. Contact support.');
      }
      const order = db.collection('orders').doc();
      for (const id of ids) tx.update(db.doc(`products/${id}`), { stock: FieldValue.increment(-qtyFor(d.items, id)), updatedAt: now() });
      tx.set(order, { items: d.items, customer: d.customer, subtotal: d.subtotal, shipping: d.shipping, total: d.total, currency: 'INR', paymentStatus: 'Paid', paymentId, razorpayOrderId: orderId, status: 'Confirmed', trackingNumber: '', createdAt: now(), updatedAt: now() });
      tx.update(ar, { status: 'Paid', paymentId, orderId: order.id, verifiedAt: now() });
      return { orderId: order.id, alreadyProcessed: false };
    });
  }

  async function verifyPayment(body) {
    const { attemptId, razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature } = body || {};
    if (!attemptId || !paymentId || !orderId || !signature) throw httpError(400, 'Missing payment verification details.');
    const expected = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    if (!equalHex(expected, String(signature))) throw httpError(400, 'Payment signature verification failed.');
    const aRef = db.doc(`paymentAttempts/${attemptId}`);
    const a = await aRef.get();
    if (!a.exists || a.data().razorpayOrderId !== orderId) throw httpError(404, 'Payment attempt not found.');
    const attempt = a.data();
    let payment = await rp.fetchPayment(paymentId);
    // Some Razorpay accounts use manual capture: capture an authorised payment for the exact order amount.
    if (payment.status === 'authorized' && payment.order_id === orderId && payment.amount === attempt.amountPaise) {
      await rp.capture(paymentId, { amount: attempt.amountPaise, currency: 'INR' });
      payment = await rp.fetchPayment(paymentId);
    }
    if (payment.order_id !== orderId || payment.status !== 'captured' || payment.amount !== attempt.amountPaise) throw httpError(409, 'Payment is not captured or amount does not match.');
    try {
      return { status: 200, body: await finalize(attemptId, paymentId, orderId) };
    } catch (err) {
      const m = String(err.message || '').toLowerCase();
      if (m.includes('stock changed') || m.includes('product no longer')) {
        let refunded = false;
        try {
          await rp.refund(paymentId, { amount: attempt.amountPaise });
          await aRef.update({ status: 'Refund Pending', paymentId, refundInitiatedAt: now() });
          refunded = true;
        } catch (refundError) {
          console.error('automatic refund failed', refundError);
          await aRef.update({ status: 'Refund Pending', paymentId, refundRequired: true }).catch(() => {});
        }
        throw httpError(409, refunded ? 'Payment was received but stock changed. A refund has been initiated to the original payment method.' : 'Payment was received but stock changed. Please contact store support for refund assistance.');
      }
      throw err;
    }
  }

  async function trackOrder(body) {
    const { orderId, mobile } = body || {};
    if (typeof orderId !== 'string' || !MOBILE.test(mobile || '')) throw httpError(400, 'Enter a valid order reference and mobile number.');
    const s = await db.doc(`orders/${orderId}`).get();
    if (!s.exists || s.data().customer?.mobile !== mobile) throw httpError(404, 'No matching order was found.');
    const d = s.data();
    return { status: 200, body: { orderId: s.id, status: d.status, paymentStatus: d.paymentStatus, trackingNumber: d.trackingNumber || '' } };
  }

  async function webhook(raw, signatureHeader) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) throw httpError(503, 'Webhook is not configured.');
    const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    if (!equalHex(expected, String(signatureHeader || ''))) throw httpError(400, 'Invalid webhook signature.');
    const event = JSON.parse(raw.toString('utf8'));
    const entity = event.payload?.payment?.entity;
    if (entity?.order_id) {
      const found = await db.collection('paymentAttempts').where('razorpayOrderId', '==', entity.order_id).limit(1).get();
      if (!found.empty) {
        const patch = { webhookLastEvent: event.event, webhookReceivedAt: now() };
        if (event.event === 'payment.failed') patch.status = 'Failed';
        if (event.event === 'payment.authorized') patch.status = 'Pending';
        if (event.event === 'payment.captured') patch.capturedPaymentId = entity.id;
        await found.docs[0].ref.update(patch);
      }
    }
    await db.collection('webhookEvents').doc(String(event.id || crypto.createHash('sha256').update(raw).digest('hex'))).set({ event: event.event, receivedAt: now() }, { merge: true });
    return { status: 200, body: { received: true } };
  }

  return { createOrder, verifyPayment, trackOrder, webhook };
}
