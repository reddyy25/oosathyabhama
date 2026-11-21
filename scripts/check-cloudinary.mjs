// Usage: npm run check-cloudinary
// Tests the Cloudinary values in .env.local WITHOUT printing the secret.
import fs from 'node:fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const cloud = (env.CLOUDINARY_CLOUD_NAME || '').trim(), key = (env.CLOUDINARY_API_KEY || '').trim(), raw = env.CLOUDINARY_API_SECRET || '', secret = raw.trim().replace(/^["']|["']$/g, '');
console.log('Cloud name :', cloud || '(missing)');
console.log('API key    :', key || '(missing)');
console.log('Secret     :', secret ? `${secret.length} characters${raw !== raw.trim() ? ' (had extra spaces - removed)' : ''}` : '(empty - run npm run add-secret)');
if (!cloud || !key || !secret) process.exit(1);
const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/ping`, { headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64') } });
const j = await r.json().catch(() => ({}));
if (r.ok) console.log('\nOK - Cloudinary accepts this cloud name, API key and secret together.');
else console.log(`\nFAILED (${r.status}): ${j?.error?.message || 'unknown'}\nThe API key and secret do not belong together for cloud "${cloud}". In Cloudinary > Settings > API Keys, copy the key AND its secret from the SAME row (environment ${cloud}) into .env.local.`);
