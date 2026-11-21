import { getServices, sendError } from './_lib/services.js';
import { readBody } from './_lib/body.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const out = await getServices().createOrder(readBody(req));
    return res.status(out.status).json(out.body);
  } catch (e) {
    return sendError(res, e, 'Unable to start secure payment. Please try again.');
  }
}
