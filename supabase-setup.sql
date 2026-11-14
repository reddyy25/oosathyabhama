-- Compatible with the existing Oo_Sathyabhama Supabase schema.
-- products: id(uuid), name, description, price, images(array), is_active,
-- created_at, updated_at.
-- orders: id(uuid), customer_name, customer_phone, customer_address,
-- total_amount, status, created_at.

alter table public.orders
  add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
drop policy if exists "Anyone can view active products (is_active)" on public.products;
create policy "Anyone can view active products (is_active)"
on public.products for select to anon, authenticated
using (is_active = true);

drop policy if exists "Anyone can submit an order" on public.orders;
create policy "Anyone can submit an order"
on public.orders for insert to anon, authenticated
with check (
  char_length(customer_name) between 1 and 120
  and char_length(customer_address) between 1 and 1000
  and total_amount >= 0
);

-- No product seed: your products table already uses UUID IDs.
