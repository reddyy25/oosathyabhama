import { getAdmin } from './firebase-admin.js';
import { razorpayClient } from './razorpay.js';
import { createPaymentService } from './payments.js';
import { httpError } from './errors.js';

const isPlaceholder = (v) => !v || /^PASTE_|placeholder/i.test(v);

export function getServices(env = process.env) {
  const missing = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'].filter((k) => isPlaceholder(env[k]));
  if (!env.FIREBASE_SERVICE_ACCOUNT_B64 && !env.FIREBASE_SERVICE_ACCOUNT) missing.push('FIREBASE_SERVICE_ACCOUNT_B64');
  if (missing.length) {
    console.error(`[payments] Missing server settings: ${missing.join(', ')}`);
    throw httpError(503, env.VERCEL ? 'Online payments are not configured yet.' : `Payments are not configured on the server. Missing: ${missing.join(', ')}. See README (Razorpay section), then restart "npm run dev".`);
  }
  const clean = { ...env, RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID.trim(), RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET.trim(), RAZORPAY_WEBHOOK_SECRET: (env.RAZORPAY_WEBHOOK_SECRET || '').trim() };
  const { db, FieldValue } = getAdmin(env);
  return createPaymentService({ db, FieldValue, rp: razorpayClient({ keyId: clean.RAZORPAY_KEY_ID, keySecret: clean.RAZORPAY_KEY_SECRET }), env: clean });
}

export function sendError(res, e, fallback, { genericStatus = 500, showMessage = false } = {}) {
  if (e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(genericStatus).json({ error: showMessage ? e.message || fallback : fallback });
}
