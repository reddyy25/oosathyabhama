// Razorpay Dashboard > Webhooks > URL: https://YOUR-DOMAIN/api/razorpay-webhook  (events: payment.captured, payment.failed)
import { getServices, sendError } from './_lib/services.js';

export const config = { api: { bodyParser: false } }; // the signature must be checked against the exact raw bytes

async function readRaw(req) {
  if (req.rawBody) return Buffer.from(req.rawBody);
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const out = await getServices().webhook(await readRaw(req), req.headers['x-razorpay-signature']);
    return res.status(out.status).json(out.body);
  } catch (e) {
    return sendError(res, e, 'Webhook could not be processed.', { genericStatus: 400 });
  }
}
