// Usage: npm run upgrade-env
// Creates .env.local if it does not exist, or adds any missing settings to your existing one. Never overwrites your values.
import fs from 'node:fs';

const FILE = '.env.local';
const DEFAULTS = [
  ['VITE_FIREBASE_API_KEY', 'AIzaSyDhycDVPfbbUlCSXzEG78qmh34Msisa3Xg'],
  ['VITE_FIREBASE_AUTH_DOMAIN', 'oosatyabhama-895e9.firebaseapp.com'],
  ['VITE_FIREBASE_PROJECT_ID', 'oosatyabhama-895e9'],
  ['VITE_FIREBASE_STORAGE_BUCKET', 'oosatyabhama-895e9.firebasestorage.app'],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', '313262905006'],
  ['VITE_FIREBASE_APP_ID', '1:313262905006:web:65095c02627ad3d2eabf3f'],
  ['VITE_FIREBASE_MEASUREMENT_ID', 'G-7MDTX7T27F'],
  ['CLOUDINARY_CLOUD_NAME', 'go96a7xa'],
  ['CLOUDINARY_API_KEY', '575831967197578'],
  ['CLOUDINARY_API_SECRET', ''],
  ['RAZORPAY_KEY_ID', ''],
  ['RAZORPAY_KEY_SECRET', ''],
  ['RAZORPAY_WEBHOOK_SECRET', ''],
  ['FIREBASE_SERVICE_ACCOUNT_B64', ''],
  ['FIREBASE_PROJECT_ID', 'oosatyabhama-895e9'],
  ['ADMIN_UIDS', 'Id3JlGikX3eMBz7lhjbeippEkPq1'],
];
let text = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const existed = text.length > 0;
// The old Firebase Functions backend URL is no longer used: payments now run from /api.
text = text.replace(/^(VITE_API_BASE_URL=.*cloudfunctions\.net.*)$/m, '# (no longer used) $1');
const added = [];
for (const [k, v] of DEFAULTS) {
  if (!new RegExp(`^${k}=`, 'm').test(text)) { text = `${text.replace(/\n*$/, '\n')}${k}=${v}\n`; added.push(k); }
}
fs.writeFileSync(FILE, text);
console.log(existed ? `Updated ${FILE}.` : `Created ${FILE}.`);
console.log(added.length ? `Added: ${added.join(', ')}` : 'Nothing to add.');
console.log('\nStill to fill in by hand (open .env.local):');
for (const k of ['CLOUDINARY_API_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']) if (!new RegExp(`^${k}=\\S`, 'm').test(text)) console.log(`  - ${k}=`);
if (!/^FIREBASE_SERVICE_ACCOUNT_B64=\S/m.test(text)) console.log('  - FIREBASE_SERVICE_ACCOUNT_B64  (run: npm run add-service-account)');
