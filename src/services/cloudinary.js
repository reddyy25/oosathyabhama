// Browser-side Cloudinary helpers. The API secret never reaches the browser:
// the admin asks /api/cloudinary-sign for a signature, then uploads straight to Cloudinary.
import { auth } from '../firebase/firebase';
import { deleteProductImage as deleteLegacyImage } from './storage';

const MAX_BYTES = 8 * 1024 * 1024;
const NO_API = 'Image service is not reachable. Start the project with "npm run dev" (local) or deploy it on Vercel with the Cloudinary environment variables.';

async function callApi(path, body) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to the admin panel again.');
  const token = await user.getIdToken();
  let res;
  try { res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body || {}) }); }
  catch { throw new Error(NO_API); }
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(data.error || (res.status === 404 ? NO_API : `Image service error (${res.status}).`));
  return data;
}

// Adds Cloudinary CDN auto-format / auto-quality delivery to a Cloudinary URL. Other URLs are returned unchanged.
export function optimizeUrl(url) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (/\/image\/upload\/[^/]*(f_auto|q_auto)/.test(url)) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

export async function uploadProductImage(file) {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" is not an image file.`);
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" is larger than 8 MB.`);
  const sig = await callApi('/api/cloudinary-sign');
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('allowed_formats', sig.allowedFormats);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  return { url: optimizeUrl(data.secure_url), publicId: data.public_id, provider: 'cloudinary' };
}

// Removes images from Cloudinary (new images) or Firebase Storage (old images). Strings / unknown shapes are ignored.
export async function deleteProductImages(images = []) {
  const list = images.filter((i) => i && typeof i === 'object');
  const cloud = list.filter((i) => i.provider === 'cloudinary' && i.publicId).map((i) => i.publicId);
  const legacy = list.filter((i) => i.provider !== 'cloudinary' && i.path);
  const jobs = legacy.map((i) => deleteLegacyImage(i.path));
  if (cloud.length) jobs.push(callApi('/api/cloudinary-delete', { publicIds: cloud }));
  const out = await Promise.allSettled(jobs);
  if (out.some((o) => o.status === 'rejected')) throw new Error('Some images could not be deleted.');
}
