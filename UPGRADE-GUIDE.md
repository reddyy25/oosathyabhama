# Oo_Sathyabhama – E-commerce upgrade guide

## What changed (and what did not)

**Untouched:** `supabase-config.js`, `supabase-setup.sql`, `admin-setup.sql`, `README.txt`, login, `admin_users`, RLS policies, the `products` storage bucket, all product/order data.

**New customer pages**
| File | Purpose |
|---|---|
| `index.html`, `script.js` | Home: search, sort, category chips (appear automatically once products have categories), Add to Cart + **Buy Now** |
| `product.html`, `product.js` | Product page: image gallery (swipe), description, size, quantity, stock, Buy Now, WhatsApp share, enquiry, copy link, related items |
| `checkout.html`, `checkout.js` | Details -> pay with PhonePe/UPI -> submit UTR/screenshot -> done |
| `common.js` | Shared code: live Supabase reads, cart (same `osb_cart` key), cart drawer |
| `api/p.js` + `vercel.json` | `/p/<product-id>` shareable link with WhatsApp photo/price preview |
| `api/create-order.js` | Server re-prices the cart from the database, checks stock, creates the order |
| `ecommerce-upgrade.sql` | **Additive** database upgrade (optional, run once) |

**Admin Panel (small additive edits only):** new statuses (Payment Verification, Shipped), a Payment column (method, UTR, "View screenshot"), "Awaiting payment check" counter, new-order alert (refreshes every 60 s), multiple product images, and optional Category/Stock fields. The extra product fields only appear after you run the SQL, so nothing changes for your client until then.

## Deploy in this order (nothing breaks at any step)

1. **Backup:** in Supabase, take a backup / export of `products` and `orders`. In Vercel, note the current deployment (you can instantly roll back to it).
2. **UPI and WhatsApp are preconfigured:** UPI ID `9392271439@ybl`; WhatsApp receiving number `+91 93922 71439`. Default delivery charge is ₹50 per order; change `SHOP.deliveryCharge` in `products.js` and the matching `delivery` value in `api/create-order.js` together if you change it.
3. **Deploy the folder to Vercel** the same way as before (Git push, or `vercel --prod`). No build command; framework preset "Other". The site works at this point **without any database change**.
4. **Run `ecommerce-upgrade.sql`** in Supabase > SQL Editor (read it first; it only adds columns, a function, a private bucket and policies). This switches on categories, stock, payment tracking, new statuses and screenshot upload.
5. Admin Panel -> Products: optionally add Category and Stock to products.

## Environment variables

**None are required.** Optional, all server-side only (Vercel > Project > Settings > Environment Variables):

| Name | Needed? | Notes |
|---|---|---|
| `SUPABASE_URL` | No | Defaults to your existing project URL |
| `SUPABASE_PUBLISHABLE_KEY` | No | Defaults to your existing public key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Only if you later want to close direct order inserts (last step of the SQL). Never put it in any `.js` file shipped to the browser. |

(No variables existed before, so no existing names were changed.) `.vercelignore` stops the `.sql` files and this guide being served publicly.

## How payment works now (manual verification)

1. Customer picks a size and taps **Buy Now** (or checks out the cart), enters name/phone/address.
2. The server recalculates product prices from Supabase, adds the configured ₹50 delivery fee, validates the 6-digit PIN code and saves the order as **Pending**.
3. Customer taps **Pay with PhonePe** / any UPI app (amount pre-filled), pays, then enters the **UTR** and optionally a screenshot.
4. The order moves to **Payment Verification**; the customer can also send the screenshot on WhatsApp to your business number (phones can share the image directly).
5. In the Admin Panel you see the order, UTR and screenshot. **Check the payment in your UPI app / bank statement (amount + UTR), then set the order to Confirmed or Cancelled. Confirmed marks payment status Verified in the Admin Panel.** A screenshot or UTR alone is never treated as proof.
6. Shipped -> Delivered as you progress.

## Official PhonePe gateway (automatic verification)

Not included because it needs your approved PhonePe merchant credentials and an end-to-end test against their sandbox, which I could not do. The code is ready for it: `api/create-order.js` already creates server-priced orders; a gateway step would add a "create payment" function and a verified callback/status-check function, with the secrets kept in Vercel environment variables. Send me the credentials/approval status when you have them.

## Testing checklist (do this on a Vercel preview deployment first)

- [ ] Home loads the **same products your client uploaded**; hide a product in Admin -> it disappears; change a price -> new price shows.
- [ ] Search finds products by name/description; sort works; works on a phone.
- [ ] Open a product, tap **Share on WhatsApp**, paste the `/p/...` link in a WhatsApp chat: photo + name + price preview appears (WhatsApp can take a minute to refresh previews).
- [ ] **Buy Now** without size shows "select a size"; with size goes to checkout; totals match.
- [ ] Place a test order -> Admin Panel -> Orders shows it as Pending with correct items and total.
- [ ] Try a tampered price: in browser dev tools change a price in the request; the saved total must still be the database price.
- [ ] Pay using the standard `upi://pay` intent (amount, payee, order note and reference prefilled), enter UTR + screenshot -> order shows **Payment Verification** with UTR and a working "View screenshot".
- [ ] Change status through Confirmed -> Shipped -> Delivered; Cancelled.
- [ ] Set a product's stock to 1 and try to order 2 -> refused.
- [ ] Old flow still works: cart -> **Order on WhatsApp** saves an order and opens WhatsApp.
- [ ] Admin login/logout, add/edit/delete product, single image upload behave as before.

Automated checks for the order/share functions and storefront helpers: `node tests/run-tests.js` (16 tests).

## Things to know

- **Stock** is shown and enforced when ordering, but it is **not reduced automatically**; update it in the Admin Panel when you confirm orders. (Auto-decrement needs the service-role key and cancel/restock rules; can be added.)
- **Admin notification:** new orders appear in the Admin Panel (auto-refresh 60 s) and the customer's WhatsApp message reaches your business number. There is no push/e-mail alert yet.
- **Spam:** the checkout has a basic bot trap but no rate limit. Run the optional hardening at the end of the SQL after setting `SUPABASE_SERVICE_ROLE_KEY` if you see junk orders.
- **Demo dresses:** the 6 sample items in `products.js` no longer appear when the database is empty (`SHOP.useDemoFallback: false`). Set it to `true` for the old behaviour.
- **Local preview (VS Code Live Server):** pages work, `/p/<id>` links and `/api` do not exist locally (the code falls back to the old direct order insert). Use a Vercel preview URL for real tests.
- **Costs:** Vercel and Supabase free tiers should cover a small shop, but Vercel's free "Hobby" plan is meant for non-commercial use, so check their current terms for a business store. UPI payments to your own UPI ID/QR normally carry no gateway fee; a PhonePe Payment Gateway account has its own fees set in your merchant agreement, so confirm those with PhonePe. I have not verified current prices.
