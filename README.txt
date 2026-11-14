Oo_Sathyabhama – Supabase integration matched to your actual schema

Existing schema from your screenshots:
products: id (uuid), name, description, price, images (array), is_active, created_at, updated_at
orders: id (uuid), customer_name, customer_phone, customer_address, total_amount, status, created_at

This version:
- Loads active products and uses the first entry in the images array.
- Saves orders using customer_phone and customer_address.
- Adds an items JSONB column to preserve product names, sizes, quantities, and prices.
- Keeps WhatsApp ordering.

Setup:
1. Run supabase-setup.sql once in Supabase SQL Editor.
2. Upload the complete Oosathyabhama folder from this ZIP to your website host.
3. Ensure products have is_active=true and images contains a usable image URL/path.
4. Test an order and check Table Editor > orders.

Only the public publishable key is used in browser code. Never put a secret/service_role key in website files.
RLS allows public visitors to read active products and insert orders, but not read orders or edit products.

PRODUCT DISPLAY NOTE
If the Supabase products table has zero active rows, the storefront automatically displays the six sample dresses bundled in products.js. To manage products from Supabase, add rows to products with name, description, price, images (array), and is_active=true. Image entries should be valid publicly accessible URLs or correct hosted image paths.

ADMIN PANEL
- Open admin.html on your hosted website (example: https://your-domain.com/admin.html).
- Admin dashboard files: admin.html, admin.css, admin.js.
- In Supabase SQL Editor, open admin-setup.sql, replace Challamanasa275@gmail.com with the exact email of the account you created under Authentication > Users, then run the full script.
- The SQL script creates a private admin allow-list and policies for product management, order viewing/status updates, and product image uploads. It also makes the existing products storage bucket public so product photos can load on the storefront.
- Sign in to admin.html with that Supabase Auth email and password.
- Do not add public users to admin_users. Never expose a Supabase secret/service_role key in browser files.
