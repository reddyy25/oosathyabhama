# Oosatyabhama store — run it on your computer (VS Code + localhost)

React + Vite storefront · Firebase (Auth + Firestore) · **Cloudinary** product images · **Razorpay** payments.
The server parts (Cloudinary signing + Razorpay payments) are the files in the `api/` folder. They run on `npm run dev` locally and on **Vercel's free plan** online. No Firebase paid plan (Blaze) is needed.

---
## A. First-time setup (new folder)

1. Unzip, then in VS Code: **File → Open Folder…** → the `oosatyabhama` folder.
2. **Terminal → New Terminal.** Run these **one at a time**, waiting for each to finish:
   ```bash
   npm install
   npm run upgrade-env
   ```
   `upgrade-env` creates `.env.local` (or adds missing lines to your existing one — it never overwrites your values).
   **If you already have a working `.env.local` from an earlier version, first copy it into this folder, then run `npm run upgrade-env`.**
3. Open **`.env.local`** and fill in the secrets (section B). Save with Cmd+S.
4. Check everything, then start:
   ```bash
   npm run check-payments
   npm run dev
   ```
5. Open **http://localhost:5173** (shop) and **http://localhost:5173/admin** (admin).
   After editing `.env.local`, stop (Control+C) and run `npm run dev` again.

## B. Where each value goes (`.env.local`)

| Line | Where to get it |
|---|---|
| `CLOUDINARY_API_SECRET=` | Cloudinary → Settings → API Keys → copy icon (same row as `CLOUDINARY_API_KEY`) |
| `RAZORPAY_KEY_ID=` and `RAZORPAY_KEY_SECRET=` | Razorpay Dashboard → switch to **Test Mode** → Account & Settings → API Keys → Generate Test Key |
| `FIREBASE_SERVICE_ACCOUNT_B64=` | Firebase Console → Project settings → Service accounts → **Generate new private key** → download the `.json`, then run `npm run add-service-account` and drag the file into the terminal. Delete the downloaded file afterwards. |

Paste values right after the `=` — no quotes, no spaces. Never share `.env.local` or put it on GitHub (it is git-ignored). Only names starting with `VITE_` ever reach the browser; everything else stays on the server.

## C. One-time Firebase setup
1. Authentication → Sign-in method → **Email/Password → Enable**; your admin user must exist (its UID is in `ADMIN_UIDS`).
2. **Firestore Database → Create database.**
3. `npx firebase-tools login` then `npm run deploy:rules` (uses `npx firebase-tools` if you have no global `firebase`).

## D. Admin panel
`/admin` → **Products → + Add product**. Images upload to Cloudinary (folder `oosatyabhama/products`) and the links are saved in Firestore. Edit a product to **Remove** images or add more; deleting a product deletes its Cloudinary images. Old products and old image links keep working.

## E. Razorpay payments (free to set up)
Checkout → `/api/create-order` (the server re-prices the cart from Firestore) → Razorpay popup → `/api/verify-payment` (checks the signature and the paid amount, reduces stock, creates the order; if stock ran out meanwhile it refunds automatically) → `/api/track-order` for order tracking.

**Test it on localhost** (Test Mode keys): add a product, add to bag, checkout. Use Razorpay's test card **4111 1111 1111 1111**, any future expiry, any CVV, any OTP; or test UPI id **success@razorpay**. The order appears in Admin → Orders and stock goes down.

**Optional webhook** (after the site is online): Razorpay Dashboard → Webhooks → URL `https://YOUR-DOMAIN/api/razorpay-webhook`, events `payment.captured` and `payment.failed`, choose a secret and put it in `RAZORPAY_WEBHOOK_SECRET`. It only records payment events; orders are created by the verify step.

**Going live:** complete Razorpay KYC, generate **Live** keys, and put them in Vercel's environment variables only (never in a file you share). Razorpay charges a small fee per successful payment; there is no monthly fee.

## F. Put it online on Vercel (free plan)
1. Push the project to GitHub (without `.env.local`) → Vercel → **Add New → Project** → import. Framework: Vite.
2. Vercel → Settings → Environment Variables: add **every** line from `.env.example` with your values (including `FIREBASE_SERVICE_ACCOUNT_B64`). Redeploy.
3. Firebase Console → Authentication → Settings → **Authorized domains** → add your Vercel domain.

## G. Checks and troubleshooting
- `npm test` runs automatic checks for Cloudinary signing, admin verification and the payment logic.
- `npm run check-payments` / `npm run check-cloudinary` test your keys without printing them.
- **"Payments are not configured… Missing: …"** → fill the named lines in `.env.local`, restart `npm run dev`.
- **Razorpay "FAILED (401)"** → Key Id and Secret are not from the same key, or one is Live and one is Test.
- **Firebase "FAILED … NOT_FOUND"** → create the Firestore database. **"PERMISSION_DENIED"** → generate a fresh service-account key.
- **"Cloudinary … Invalid Signature"** → the API key/secret pair is wrong; copy both from the same row.
- **"Missing or insufficient permissions" in admin** → run `npm run deploy:rules`.
- The old Firebase Cloud Functions in `functions/` are no longer used (kept for reference only; see `docs/`).
