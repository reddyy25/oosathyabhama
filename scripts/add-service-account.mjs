// Usage: npm run add-service-account
// Reads the service-account JSON file you downloaded from Firebase and stores it (encoded) in .env.local on YOUR computer.
// Tip: when asked for the path, drag the downloaded .json file into the terminal window.
import fs from 'node:fs';
import readline from 'node:readline';

const FILE = '.env.local';
if (!fs.existsSync(FILE)) { console.error('Cannot find .env.local. Run: npm run upgrade-env'); process.exit(1); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Path of the downloaded Firebase service-account .json file (drag the file here), then press Enter: ', (answer) => {
  rl.close();
  const path = answer.trim().replace(/^['"]|['"]$/g, '').replace(/\\ /g, ' ');
  let sa;
  try { sa = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { console.error('\nCould not read that file as JSON. Nothing was changed.'); process.exit(1); }
  if (sa.type !== 'service_account' || !sa.private_key || !sa.client_email || !sa.project_id) { console.error('\nThis is not a Firebase service-account key file. Nothing was changed.'); process.exit(1); }
  let text = fs.readFileSync(FILE, 'utf8');
  const expected = (/^VITE_FIREBASE_PROJECT_ID=(.*)$/m.exec(text) || [])[1];
  if (expected && expected.trim() !== sa.project_id) { console.error(`\nThis key is for project "${sa.project_id}" but your site uses "${expected.trim()}". Nothing was changed.`); process.exit(1); }
  const line = `FIREBASE_SERVICE_ACCOUNT_B64=${Buffer.from(JSON.stringify(sa)).toString('base64')}`;
  text = /^FIREBASE_SERVICE_ACCOUNT_B64=.*$/m.test(text) ? text.replace(/^FIREBASE_SERVICE_ACCOUNT_B64=.*$/m, () => line) : `${text.replace(/\n*$/, '\n')}${line}\n`;
  fs.writeFileSync(FILE, text);
  console.log(`\nSaved for project ${sa.project_id}. Restart "npm run dev". Then DELETE the downloaded .json file from your Downloads folder.`);
});
