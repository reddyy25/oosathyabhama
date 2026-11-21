// Server-side Cloudinary helpers. The API secret is read from environment variables
// and is NEVER sent to the browser.
import crypto from 'node:crypto';

export const UPLOAD_FOLDER = 'oosatyabhama/products';
export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif,gif';

export function getConfig(env = process.env) {
  const entries = [
    ['CLOUDINARY_CLOUD_NAME', env.CLOUDINARY_CLOUD_NAME],
    ['CLOUDINARY_API_KEY', env.CLOUDINARY_API_KEY],
    ['CLOUDINARY_API_SECRET', env.CLOUDINARY_API_SECRET],
  ];
  const missing = entries.filter(([, v]) => !v || /^your_|^<|placeholder/i.test(v)).map(([k]) => k);
  if (missing.length) {
    const err = new Error(`Cloudinary is not configured on the server. Missing: ${missing.join(', ')}. Add them to .env.local and restart "npm run dev" (or add them in Vercel > Settings > Environment Variables).`);
    err.status = 500;
    throw err;
  }
  const clean = (v) => String(v).trim().replace(/^["']|["']$/g, '');
  return { cloudName: clean(env.CLOUDINARY_CLOUD_NAME), apiKey: clean(env.CLOUDINARY_API_KEY), apiSecret: clean(env.CLOUDINARY_API_SECRET) };
}

// Cloudinary signature: SHA-1 of the alphabetically sorted "key=value" pairs joined with "&", followed by the API secret.
export function signParams(params, secret) {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

// Only images this app uploaded (inside our folder) may be deleted through the API.
export function isManagedPublicId(id) {
  return typeof id === 'string' && id.startsWith(`${UPLOAD_FOLDER}/`) && !id.includes('..') && id.length <= 200;
}

export async function destroyImage(publicId, cfg, fetchImpl = fetch) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ public_id: publicId, timestamp }, cfg.apiSecret);
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: cfg.apiKey, signature });
  const r = await fetchImpl(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/destroy`, { method: 'POST', body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Cloudinary error ${r.status}`);
  return data.result;
}
