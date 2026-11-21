import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createPaymentService } from '../api/_lib/payments.js';

// ---- tiny in-memory Firestore stand-in ----
function makeDb(seed) {
  const store = new Map(Object.entries(seed));
  let n = 0;
  const apply = (old, patch) => {
    const o = { ...(old || {}) };
    for (const [k, v] of Object.entries(patch)) o[k] = v && v.__inc !== undefined ? (o[k] || 0) + v.__inc : v && v.__ts ? 'TS' : v;
    return o;
  };
  const snap = (path) => ({ exists: store.has(path), id: path.split('/').pop(), data: () => (store.has(path) ? JSON.parse(JSON.stringify(store.get(path))) : undefined), ref: ref(path) });
  const ref = (path) => ({
    path, id: path.split('/').pop(),
    get: async () => snap(path),
    set: async (d, opts) => { store.set(path, opts?.merge ? apply(store.get(path), d) : apply({}, d)); },
    update: async (p) => { if (!store.has(path)) throw Error('not found'); store.set(path, apply(store.get(path), p)); },
  });
  return {
    store, doc: ref,
    collection: (name) => ({
      doc: (id) => ref(`${name}/${id || 'auto' + ++n}`),
      where: (f, op, v) => ({ limit: () => ({ get: async () => { const docs = [...store.entries()].filter(([p, d]) => p.startsWith(name + '/') && d[f] === v).map(([p]) => snap(p)); return { empty: !docs.length, docs }; } }) }),
    }),
    runTransaction: async (fn) => { const w = []; const tx = { get: (r) => r.get(), update: (r, p) => w.push(() => r.update(p)), set: (r, d) => w.push(() => r.set(d)) }; const out = await fn(tx); for (const x of w) await x(); return out; },
  };
}
const FieldValue = { serverTimestamp: () => ({ __ts: 1 }), increment: (n) => ({ __inc: n }) };
const SECRET = 'test_secret', WH = 'wh_secret';
const customer = { fullName: 'Asha Rao', mobile: '9876543210', address: '1 Main Rd', city: 'Hyderabad', state: 'Telangana', pincode: '500001', email: 'a@b.c' };
const cart = (q = 2) => [{ productId: 'p1', quantity: q, size: 'M', color: 'Pink' }];

function setup({ payment } = {}) {
  const db = makeDb({
    'products/p1': { name: 'Kurti', price: 500, stock: 5, sizes: ['M', 'L'], colors: ['Pink'], active: true, images: [{ url: 'https://img/1.jpg' }] },
    'settings/store': { shippingCharges: 50, freeShippingThreshold: 2000 },
  });
  const calls = { capture: [], refund: [] };
  const state = { payment: payment || { order_id: 'order_1', status: 'captured', amount: 105000 } };
  const rp = {
    createOrder: async (b) => ({ id: 'order_1', amount: b.amount, currency: 'INR' }),
    fetchPayment: async () => ({ ...state.payment }),
    capture: async (id, b) => { calls.capture.push([id, b]); state.payment = { ...state.payment, status: 'captured' }; },
    refund: async (id, b) => { calls.refund.push([id, b]); },
  };
  const svc = createPaymentService({ db, FieldValue, rp, env: { RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_WEBHOOK_SECRET: WH } });
  return { db, svc, calls, state };
}
const sign = (o, p) => crypto.createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');
const verifyBody = (attemptId, p = 'pay_1') => ({ attemptId, razorpay_payment_id: p, razorpay_order_id: 'order_1', razorpay_signature: sign('order_1', p) });
const code = (promise) => promise.then(() => 200, (e) => e.status);

test('createOrder prices on the server, adds shipping, stores an attempt', async () => {
  const { svc, db } = setup();
  const out = await svc.createOrder({ items: cart(2), customer });
  assert.equal(out.body.amount, 105000);
  assert.equal(out.body.keyId, 'rzp_test_x');
  const a = db.store.get(`paymentAttempts/${out.body.attemptId}`);
  assert.equal(a.status, 'Created'); assert.equal(a.total, 1050); assert.equal(a.items[0].image, 'https://img/1.jpg');
});
test('createOrder: free shipping above threshold; validation and stock errors', async () => {
  const { svc } = setup();
  assert.equal((await svc.createOrder({ items: cart(5), customer })).body.amount, 250000);
  assert.equal(await code(svc.createOrder({ items: cart(6), customer })), 409);
  assert.equal(await code(svc.createOrder({ items: [{ productId: 'p1', quantity: 1, size: 'XL', color: 'Pink' }], customer })), 409);
  assert.equal(await code(svc.createOrder({ items: cart(1), customer: { ...customer, mobile: '123' } })), 400);
  assert.equal(await code(svc.createOrder({ items: [], customer })), 400);
});
test('verifyPayment creates the order once, reduces stock, is idempotent', async () => {
  const { svc, db } = setup();
  const { body } = await svc.createOrder({ items: cart(2), customer });
  const r1 = (await svc.verifyPayment(verifyBody(body.attemptId))).body;
  assert.equal(r1.alreadyProcessed, false);
  assert.equal(db.store.get('products/p1').stock, 3);
  const order = db.store.get(`orders/${r1.orderId}`);
  assert.equal(order.paymentStatus, 'Paid'); assert.equal(order.customer.mobile, '9876543210');
  const r2 = (await svc.verifyPayment(verifyBody(body.attemptId))).body;
  assert.deepEqual([r2.orderId, r2.alreadyProcessed], [r1.orderId, true]);
  assert.equal(db.store.get('products/p1').stock, 3);
});
test('verifyPayment rejects a bad signature and a wrong amount', async () => {
  const { svc, state } = setup();
  const { body } = await svc.createOrder({ items: cart(2), customer });
  assert.equal(await code(svc.verifyPayment({ ...verifyBody(body.attemptId), razorpay_signature: 'ab'.repeat(32) })), 400);
  state.payment.amount = 100;
  assert.equal(await code(svc.verifyPayment(verifyBody(body.attemptId))), 409);
});
test('verifyPayment captures an authorised payment first (manual-capture accounts)', async () => {
  const { svc, calls } = setup({ payment: { order_id: 'order_1', status: 'authorized', amount: 105000 } });
  const { body } = await svc.createOrder({ items: cart(2), customer });
  const out = await svc.verifyPayment(verifyBody(body.attemptId));
  assert.equal(out.status, 200); assert.equal(calls.capture.length, 1); assert.equal(calls.capture[0][1].amount, 105000);
});
test('stock gone before verification triggers an automatic refund', async () => {
  const { svc, db, calls } = setup();
  const { body } = await svc.createOrder({ items: cart(2), customer });
  db.store.get('products/p1').stock = 0;
  await assert.rejects(svc.verifyPayment(verifyBody(body.attemptId)), (e) => e.status === 409 && /refund has been initiated/.test(e.message));
  assert.equal(calls.refund.length, 1); assert.equal(calls.refund[0][1].amount, 105000);
  assert.equal(db.store.get(`paymentAttempts/${body.attemptId}`).status, 'Refund Pending');
});
test('trackOrder needs the matching mobile number', async () => {
  const { svc } = setup();
  const { body } = await svc.createOrder({ items: cart(2), customer });
  const { orderId } = (await svc.verifyPayment(verifyBody(body.attemptId))).body;
  const ok = await svc.trackOrder({ orderId, mobile: '9876543210' });
  assert.deepEqual([ok.body.status, ok.body.paymentStatus], ['Confirmed', 'Paid']);
  assert.equal(await code(svc.trackOrder({ orderId, mobile: '9123456780' })), 404);
  assert.equal(await code(svc.trackOrder({ orderId, mobile: 'abc' })), 400);
});
test('webhook: signature required; payment.failed marks the attempt', async () => {
  const { svc, db } = setup();
  const { body } = await svc.createOrder({ items: cart(2), customer });
  const raw = Buffer.from(JSON.stringify({ id: 'evt_1', event: 'payment.failed', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_1' } } } }));
  assert.equal(await code(svc.webhook(raw, 'bad')), 400);
  const good = crypto.createHmac('sha256', WH).update(raw).digest('hex');
  assert.equal((await svc.webhook(raw, good)).status, 200);
  assert.equal(db.store.get(`paymentAttempts/${body.attemptId}`).status, 'Failed');
  assert.ok(db.store.has('webhookEvents/evt_1'));
});
