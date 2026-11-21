// POST /api/cloudinary-sign  (admin only)
// Returns a short-lived signature so the admin browser can upload an image straight to Cloudinary.
import { requireAdmin } from './_lib/auth.js';
import { getConfig, signParams, UPLOAD_FOLDER, ALLOWED_FORMATS } from './_lib/cloudinary.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const cfg = getConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signParams({ allowed_formats: ALLOWED_FORMATS, folder: UPLOAD_FOLDER, timestamp }, cfg.apiSecret);
    return res.status(200).json({ cloudName: cfg.cloudName, apiKey: cfg.apiKey, timestamp, signature, folder: UPLOAD_FOLDER, allowedFormats: ALLOWED_FORMATS });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
}
