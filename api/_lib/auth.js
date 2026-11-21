// Verifies a Firebase Authentication ID token on the server WITHOUT any service-account secret,
// by checking its RS256 signature against Google's public keys. No extra npm packages needed.
import crypto from 'node:crypto';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cache = { keys: null, exp: 0 };
export const resetKeyCache = () => { cache = { keys: null, exp: 0 }; };

const httpError = (status, message) => Object.assign(new Error(message), { status });

async function getKeys(fetchImpl) {
  if (cache.keys && Date.now() < cache.exp) return cache.keys;
  const r = await fetchImpl(JWKS_URL);
  if (!r.ok) throw httpError(503, 'Could not load Google signing keys. Please try again.');
  const data = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers?.get?.('cache-control') || '');
  cache = { keys: data.keys || [], exp: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
  return cache.keys;
}

export async function verifyIdToken(token, { projectId, fetchImpl = fetch, now = Date.now() } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw httpError(401, 'Invalid sign-in token. Please sign in again.');
  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { throw httpError(401, 'Invalid sign-in token. Please sign in again.'); }
  if (header.alg !== 'RS256' || !header.kid) throw httpError(401, 'Invalid sign-in token. Please sign in again.');
  const keys = await getKeys(fetchImpl);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw httpError(401, 'Sign-in token not recognised. Please sign in again.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw httpError(401, 'Invalid sign-in token. Please sign in again.');
  const nowS = Math.floor(now / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw httpError(401, 'Token is for a different Firebase project.');
  if (!payload.sub || typeof payload.sub !== 'string') throw httpError(401, 'Invalid sign-in token.');
  if (typeof payload.exp !== 'number' || payload.exp <= nowS) throw httpError(401, 'Your session expired. Please sign in again.');
  if (typeof payload.iat === 'number' && payload.iat > nowS + 300) throw httpError(401, 'Invalid sign-in token.');
  return payload;
}

// Admin = Firebase custom claim admin:true OR a UID listed in ADMIN_UIDS (comma separated).
export async function requireAdmin(req, env = process.env, fetchImpl = fetch) {
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw httpError(500, 'FIREBASE_PROJECT_ID is not set on the server.');
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) throw httpError(401, 'Please sign in to the admin panel first.');
  const payload = await verifyIdToken(m[1], { projectId, fetchImpl });
  const adminUids = String(env.ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (payload.admin !== true && !adminUids.includes(payload.sub)) throw httpError(403, 'This account is not an administrator.');
  return payload;
}
