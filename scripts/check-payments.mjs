// Usage: npm run check-payments  — tests the Razorpay keys and the Firebase service account without printing any secret.
import fs from 'node:fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2].trim(); }
Object.assign(process.env, env);
let bad = 0;

const id = env.RAZORPAY_KEY_ID, secret = env.RAZORPAY_KEY_SECRET;
if (!id || !secret) { console.log('Razorpay : MISSING - fill RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local'); bad++; }
else {
  const r = await fetch('https://api.razorpay.com/v1/orders?count=1', { headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') } });
  const j = await r.json().catch(() => ({}));
  if (r.ok) console.log(`Razorpay : OK (${id.startsWith('rzp_live') ? 'LIVE mode - real money!' : 'TEST mode'})`);
  else { console.log(`Razorpay : FAILED (${r.status}) ${j?.error?.description || ''}\n           Copy the Key Id and Key Secret from the same Razorpay API key.`); bad++; }
}

if (!env.FIREBASE_SERVICE_ACCOUNT_B64) { console.log('Firebase : MISSING - run: npm run add-service-account'); bad++; }
else {
  try {
    const { getAdmin } = await import('../api/_lib/firebase-admin.js');
    const { db } = getAdmin(process.env);
    await db.doc('settings/store').get();
    console.log('Firebase : OK (service account can read Firestore)');
  } catch (e) {
    const hint = /NOT_FOUND|5 NOT_FOUND/.test(String(e.message)) ? ' - create the Firestore database in the Firebase Console' : '';
    console.log(`Firebase : FAILED - ${e.message}${hint}`); bad++;
  }
}
console.log(bad ? '\nFix the items above, then run this again.' : '\nAll good. Run: npm run dev');
process.exit(bad ? 1 : 0);
