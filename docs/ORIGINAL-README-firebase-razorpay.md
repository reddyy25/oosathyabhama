> **Legacy document.** Payments now run from the `api/` folder (free Vercel plan), not Firebase Cloud Functions. See the main README.

# Oosatyabhama — Ethnic Elegance, Everyday Style

Premium women's kurtis storefront built with React, Vite, Firebase (Authentication, Firestore, Storage, Cloud Functions) and Razorpay. Customer checkout is guest-only. **Razorpay online payment is the only payment method; Cash on Delivery is not implemented.**

> This repository is a deployment-ready implementation template, not a connected live store. You must create your Firebase and Razorpay accounts, add your own environment values, deploy the backend and authorize an administrator before accepting real orders. No credentials are included.

## 1. Extract on macOS and open in VS Code

1. Double-click the ZIP in Finder to extract it.
2. Open VS Code → File → Open Folder → select `oosatyabhama`.
3. Open Terminal → New Terminal.
4. Install Node.js 20 LTS or newer and npm if they are not already installed.

## 2. Install and run the frontend

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Stop the server with Control+C. Build the static frontend with `npm run build`; preview it with `npm run preview`.

Without Firebase configuration, the app is only a local UI shell and cannot load or save live products. Add the Firebase Web App values to `.env.local` before expecting live data.

## 3. Create and configure Firebase

1. Create a project at https://console.firebase.google.com/.
2. Add a **Web App** in Project settings and copy its config values into `.env.local` using the names in `.env.example`.
3. In Authentication → Sign-in method, enable **Email/Password**. Do not build a public admin registration page. Create the first admin account in Firebase Console → Authentication → Users.
4. Create a Cloud Firestore database. Choose a region close to your customers; the sample Cloud Functions region is `asia-south1` (Mumbai).
5. Create a Firebase Storage bucket.
6. From the project root, install Firebase CLI and sign in:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Select the same project used by the Web App and verify `.firebaserc` points to that project. `.firebaserc` is intentionally not included because it is project-specific.

7. Deploy the supplied Firestore and Storage rules:

```bash
firebase deploy --only firestore:rules,storage
```

The rules make product/category/store settings readable as intended, restrict product/order writes to admins, and deny customer reads of private orders and payment attempts. Backend Admin SDK functions use server privileges and validate sensitive payment and stock operations themselves.

## 4. Add the first administrator securely

The admin page is `/admin`. There is no public registration flow. First create a user in Firebase Authentication → Users, then copy that user's UID. Authenticate the local terminal with Google Application Default Credentials and assign the trusted custom claim:

```bash
gcloud auth application-default login
GCLOUD_PROJECT=YOUR_FIREBASE_PROJECT_ID node scripts/set-admin.mjs FIREBASE_AUTH_UID
```

Install Google Cloud CLI if needed. The operator running this command must have permission to administer Firebase Authentication. The custom claim `admin: true` is the only admin authorization signal used by the UI and Firestore rules. Sign out and sign back in after setting the claim so the ID token refreshes. Never set an admin flag from browser code.

## 5. Seed sample products

The file `sample-products.json` contains five example product records. Seed them after Firebase Admin credentials are configured:

```bash
GCLOUD_PROJECT=YOUR_FIREBASE_PROJECT_ID node scripts/seed-products.mjs
```

This script writes the sample products and a `settings/store` document. Product image URLs are sample external image references; replace them with your own licensed product photography in Admin → Products. Product management supports multiple uploads to Firebase Storage.

## 6. Configure Razorpay test mode

1. Create a Razorpay account and use its **Test Mode** dashboard.
2. Generate a Test Key ID and Key Secret.
3. In Firebase Functions secrets, set the secrets (the secret values are never added to frontend environment variables):

```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
```

Enter the test Key ID, test Key Secret, and a webhook secret you choose. Configure a Razorpay webhook URL after deploying the backend (see below). Subscribe to relevant payment events such as `payment.captured`, `payment.failed`, and `order.paid` as required by your Razorpay account configuration.

For the sample verification flow, configure Razorpay to capture successful payments automatically. The backend checks the signature, fetches the payment from Razorpay, and requires the payment status to be `captured`, the order ID to match, and the captured amount to match the server-calculated amount.

## 7. Deploy Firebase backend functions

Cloud Functions v2 and secrets require a Firebase project on the **Blaze (pay-as-you-go) plan**. Set a billing budget alert before deployment. The backend is in `functions/` and exports one HTTPS function named `api` with these routes:

- `POST /create-order` — re-reads prices, options, stock and shipping from Firestore; creates a Razorpay order and private payment attempt.
- `POST /verify-payment` — verifies Razorpay HMAC signature, fetches the payment from Razorpay, confirms captured amount and idempotently creates the order/decrements inventory in a Firestore transaction.
- `POST /track-order` — returns limited tracking details only when order ID and delivery mobile number match.
- `POST /razorpay-webhook` — verifies the raw-body webhook signature and records event receipt. The browser-return verification endpoint remains the authoritative order finalization path in this starter.

Deploy:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

After deploy, copy the `api` HTTPS URL shown by Firebase. The function is in `asia-south1`. Set the frontend API base URL in `.env.local` to the deployed function URL ending in `/api`, for example:

```dotenv
VITE_API_BASE_URL=https://asia-south1-YOUR_PROJECT.cloudfunctions.net/api
```

Restart Vite after editing environment values. For production, add the same `VITE_API_BASE_URL` and Firebase `VITE_*` variables in Vercel Project → Settings → Environment Variables, then redeploy.

In Razorpay Dashboard → Webhooks, add:

`https://asia-south1-YOUR_PROJECT.cloudfunctions.net/api/razorpay-webhook`

Use the exact same webhook secret entered for `RAZORPAY_WEBHOOK_SECRET` and select the events you want recorded. Webhook receipts are recorded for reconciliation; this initial implementation does not independently finalize an order from a webhook-only event.

## 8. GitHub and Vercel deployment

```bash
git init
git add .
git commit -m "Initial Oosatyabhama store"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

In https://vercel.com/, import the GitHub repository. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. Add all frontend Firebase `VITE_*` variables and `VITE_API_BASE_URL` in Vercel settings for Preview and Production as appropriate. Deploy. Add your custom domain in Vercel and follow its DNS instructions. The included `vercel.json` rewrites SPA routes to `index.html`.

Never add `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, Firebase service-account JSON, or other server credentials to Vercel's `VITE_*` variables or frontend source. `VITE_*` values are public browser configuration.

## 9. Test mode checklist

- Browse the home page, categories, product details and search/filter controls.
- Add products with different sizes/colours to the cart; verify cart and wishlist persist in localStorage.
- Try checkout with invalid mobile/PIN data and confirm validation blocks payment launch.
- Use Razorpay Test Mode test payment instruments from the official Razorpay documentation/dashboard.
- Verify successful captured payments create exactly one Firestore order and decrement stock once.
- Verify failed, dismissed, mismatched-signature and mismatched-amount payments do not create confirmed orders.
- Retry the same successful verification request and confirm the existing order ID is returned without a second stock decrement.
- Verify a customer cannot read `/orders` or `/paymentAttempts` from the browser SDK.
- Sign in at `/admin` with an account without the `admin` custom claim and confirm access is denied; then test with the authorized admin.
- Test product image upload, product editing, order status and tracking updates on mobile and desktop widths.

Real payment tests require your Razorpay Test Mode account, Firebase credentials, deployed or emulator backend, and configured secrets. Do not claim these integrations have passed until you execute the tests in your own project.

## 10. Switch to live payments

1. Complete all test-mode cases first.
2. Complete Razorpay account activation and any required KYC/business verification.
3. Obtain Live Key ID and Live Key Secret from Razorpay.
4. Replace Firebase secrets with live credentials using `firebase functions:secrets:set` and redeploy functions.
5. Configure the live webhook URL and secret in Razorpay Live Mode.
6. Confirm the production frontend points only to the production Firebase API.
7. Run a controlled low-value live transaction and refund it from the Razorpay Dashboard to validate settlement and refund operations.

Never use live credentials in local commits, chat messages, screenshots or browser code. Keep webhook and key secrets in Firebase Secret Manager.

## 11. Refunds, cancellations and order statuses

Payment status is established by the verified payment flow. Refunds must be initiated in the Razorpay Dashboard by an authorized operator and reconciled there; this starter does not expose an unprotected client-side refund action. For a paid order, refund the payment first in Razorpay and confirm the refund status before setting the order to Cancelled in the admin workflow. Admin can update order status and tracking number. Do not mark an order Refunded until Razorpay confirms the refund.

Order status values used: Pending, Confirmed, Processing, Shipped, Delivered, Cancelled. Payment status values include Created, Pending, Paid, Failed, Refund Pending and Refunded; the initial checkout creates an internal payment attempt, not a customer-visible confirmed order, until verification succeeds.

## 12. Troubleshooting

- **Firebase `auth/invalid-api-key`:** check `.env.local`, project Web App config and restart Vite.
- **Products do not appear:** deploy Firestore rules, seed products, check `active: true`, and inspect browser console.
- **Admin access denied:** assign the `admin: true` custom claim to the correct Auth UID, then sign out/in to refresh the token.
- **Image upload denied:** check Storage rules, admin claim, image MIME type and the 8 MB limit.
- **Backend 500 / missing secret:** verify all three Firebase Function secrets and redeploy functions.
- **Razorpay checkout does not open:** confirm the checkout script loaded, the API URL is correct, and the backend returns a Test Mode key ID.
- **Payment signature/capture error:** confirm the frontend and backend use the same Razorpay mode/key pair and automatic capture is enabled.
- **Cloud Function deployment asks for billing:** Cloud Functions v2 deployment requires Blaze billing; set a budget alert and review usage.
- **Vercel refresh gives 404:** ensure `vercel.json` is present and the output directory is `dist`.

## 13. Cost and free-tier notes

- React, Vite, this source code and local development are free/open-source.
- Vercel offers a free Hobby tier subject to its current usage and commercial-use terms; check its current plan rules for your business.
- Firebase Authentication and Firestore have no-cost quotas on eligible plans, but quotas, availability and billing rules can change.
- Firebase Cloud Functions v2, Secret Manager and some Storage configurations require Blaze/pay-as-you-go billing. Network, compute, storage and database usage can incur charges after included allowances.
- Razorpay requires a merchant account and charges transaction/payment-processing fees according to your agreement and payment method. It is not a free payment gateway.
- Domains, email/SMS services, premium image delivery, taxes and other third-party services may cost extra.

Check current pricing and limits before launch: https://firebase.google.com/pricing, https://vercel.com/pricing and https://razorpay.com/pricing/.

## Project structure

```text
src/
  admin/          Admin sign-in, dashboard, products and order management
  assets/         Brand logo
  components/     Header, footer, product cards and grid
  context/        Cart and wishlist state (localStorage)
  firebase/       Firebase app and admin auth helpers
  pages/          Storefront, product, checkout, tracking and policy pages
  services/       Firestore, Storage and backend API clients
  styles/         Responsive premium brand styles
  utils/          Currency and discount helpers
functions/src/    Secure Razorpay and order API
firestore.rules   Firestore access policy
storage.rules     Product image upload policy
sample-products.json
scripts/          Product seeding and admin custom-claim scripts
```
