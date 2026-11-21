// Usage: npm run add-secret
// Asks for your Cloudinary API secret and writes it into .env.local on YOUR computer only.
import fs from 'node:fs';
import readline from 'node:readline';

const FILE = '.env.local';
if (!fs.existsSync(FILE)) { console.error(`Cannot find ${FILE}. Open the project folder in VS Code first (File > Open Folder).`); process.exit(1); }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
rl._writeToOutput = (s) => { if (rl.muted && !/[\r\n]/.test(s)) rl.output.write('*'); else rl.output.write(s); };
process.stdout.write('Paste your NEW Cloudinary API secret, then press Enter: ');
rl.muted = true;
rl.question('', (answer) => {
  rl.close();
  const secret = answer.trim().replace(/^["']|["']$/g, '');
  if (secret.length < 10 || /\s/.test(secret)) { console.error('\nThat does not look like a Cloudinary API secret. Nothing was changed.'); process.exit(1); }
  let text = fs.readFileSync(FILE, 'utf8');
  const line = `CLOUDINARY_API_SECRET=${secret}`;
  text = /^CLOUDINARY_API_SECRET=.*$/m.test(text) ? text.replace(/^CLOUDINARY_API_SECRET=.*$/m, () => line) : `${text.replace(/\n*$/, '\n')}${line}\n`;
  fs.writeFileSync(FILE, text);
  console.log('\nSaved to .env.local. Now run: npm run dev');
});
