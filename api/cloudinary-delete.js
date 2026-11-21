// POST /api/cloudinary-delete  body: { publicIds: ["oosatyabhama/products/..."] }  (admin only)
import { requireAdmin } from './_lib/auth.js';
import { readBody } from './_lib/body.js';
import { getConfig, destroyImage, isManagedPublicId } from './_lib/cloudinary.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await requireAdmin(req);
    const cfg = getConfig();
    const ids = [...new Set((readBody(req).publicIds || []).filter(isManagedPublicId))].slice(0, 30);
    const results = [];
    for (const publicId of ids) {
      try { results.push({ publicId, result: await destroyImage(publicId, cfg) }); }
      catch (err) { results.push({ publicId, error: err.message }); }
    }
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
}
