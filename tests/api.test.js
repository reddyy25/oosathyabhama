import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { signParams, isManagedPublicId, getConfig } from '../api/_lib/cloudinary.js';
import { verifyIdToken, requireAdmin, resetKeyCache } from '../api/_lib/auth.js';
import { createApiMiddleware } from '../api/_lib/dev-middleware.js';

const PROJECT = 'demo-project';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const jwksFetch = async () => ({ ok: true, json: async () => ({ keys: [jwk] }), headers: { get: () => 'max-age=3600' } });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function makeToken(over = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const p = b64({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'uid-admin', iat: now - 10, exp: now + 3600, ...over });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const env = { FIREBASE_PROJECT_ID: PROJECT, ADMIN_UIDS: 'uid-admin', CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'sekret' };
const req = (t) => ({ headers: { authorization: `Bearer ${t}` } });

test('Cloudinary signature matches the documented example', () => {
  const s = signParams({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: '1315060510' }, 'abcd');
  assert.equal(s, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
});
test('signature ignores empty values and sorts keys', () => {
  assert.equal(signParams({ b: 2, a: 1, c: '' }, 's'), crypto.createHash('sha1').update('a=1&b=2s').digest('hex'));
});
test('only our folder is deletable', () => {
  assert.ok(isManagedPublicId('oosatyabhama/products/abc'));
  assert.ok(!isManagedPublicId('other/abc'));
  assert.ok(!isManagedPublicId('oosatyabhama/products/../x'));
  assert.ok(!isManagedPublicId(42));
});
test('getConfig reports missing/blank secret', () => {
  assert.throws(() => getConfig({ CLOUDINARY_CLOUD_NAME: 'a', CLOUDINARY_API_KEY: 'b', CLOUDINARY_API_SECRET: '' }), /CLOUDINARY_API_SECRET/);
  assert.equal(getConfig(env).cloudName, 'democloud');
});
test('valid token verifies; tampered / wrong project / expired rejected', async () => {
  resetKeyCache();
  assert.equal((await verifyIdToken(makeToken(), { projectId: PROJECT, fetchImpl: jwksFetch })).sub, 'uid-admin');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  await assert.rejects(verifyIdToken(makeToken({}, other), { projectId: PROJECT, fetchImpl: jwksFetch }), /Invalid sign-in token/);
  await assert.rejects(verifyIdToken(makeToken({ aud: 'x' }), { projectId: PROJECT, fetchImpl: jwksFetch }), /different Firebase project/);
  await assert.rejects(verifyIdToken(makeToken({ exp: 1 }), { projectId: PROJECT, fetchImpl: jwksFetch }), /expired/);
  await assert.rejects(verifyIdToken('garbage', { projectId: PROJECT, fetchImpl: jwksFetch }), /Invalid/);
});
test('requireAdmin: uid list, admin claim, non-admin, missing header', async () => {
  resetKeyCache();
  await requireAdmin(req(makeToken()), env, jwksFetch);
  await requireAdmin(req(makeToken({ sub: 'someone', admin: true })), env, jwksFetch);
  await assert.rejects(requireAdmin(req(makeToken({ sub: 'customer' })), env, jwksFetch), /not an administrator/);
  await assert.rejects(requireAdmin({ headers: {} }, env, jwksFetch), /sign in/i);
});

// End-to-end through the same middleware `npm run dev` uses, with Google's key fetch + Cloudinary mocked.
test('/api/cloudinary-sign and /api/cloudinary-delete over HTTP', async () => {
  Object.assign(process.env, env);
  resetKeyCache();
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('googleapis.com/service_accounts')) return jwksFetch();
    calls.push({ url: String(url), body: opts?.body?.toString() });
    return { ok: true, json: async () => ({ result: 'ok' }) };
  };
  const mw = createApiMiddleware(process.cwd());
  const server = http.createServer((q, r) => mw(q, r, () => { r.statusCode = 404; r.end('next'); }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, token, body) => realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
  try {
    assert.equal((await post('/api/cloudinary-sign')).status, 401);
    assert.equal((await post('/api/cloudinary-sign', makeToken({ sub: 'customer' }))).status, 403);
    const ok = await post('/api/cloudinary-sign', makeToken());
    assert.equal(ok.status, 200);
    const j = await ok.json();
    assert.equal(j.cloudName, 'democloud'); assert.equal(j.folder, 'oosatyabhama/products');
    assert.equal(j.signature, signParams({ allowed_formats: j.allowedFormats, folder: j.folder, timestamp: j.timestamp }, 'sekret'));
    assert.ok(!JSON.stringify(j).includes('sekret'), 'API secret must never be returned');
    const del = await post('/api/cloudinary-delete', makeToken(), { publicIds: ['oosatyabhama/products/a1', 'evil/other', 'oosatyabhama/products/a1'] });
    assert.equal(del.status, 200);
    const dj = await del.json();
    assert.equal(dj.results.length, 1);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v1_1\/democloud\/image\/destroy$/);
    assert.match(calls[0].body, /public_id=oosatyabhama%2Fproducts%2Fa1/);
    assert.ok(!calls[0].body.includes('sekret'));
    assert.equal((await realFetch(base + '/api/cloudinary-sign')).status, 405);
    assert.equal((await realFetch(base + '/something-else')).status, 404);
  } finally { globalThis.fetch = realFetch; server.close(); }
});
