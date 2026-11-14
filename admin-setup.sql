-- Run this AFTER creating the admin user in Supabase Authentication.
-- Replace Challamanasa275@gmail.com with the exact email used for the admin login.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
drop policy if exists "Admins can view their own admin record" on public.admin_users;
create policy "Admins can view their own admin record"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

-- Add your authorised Auth user to the admin allow-list.
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('Challamanasa275@gmail.com')
on conflict (user_id) do nothing;

-- Let authorised admins manage products, while visitors can still read active products.
drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
on public.products for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Only authorised admins can read and update customer orders.
drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
on public.orders for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Storage: make the existing products bucket public so storefront visitors can load images.
update storage.buckets set public = true where id = 'products';

-- These policies allow only authorised admins to upload, change, or delete product images.
drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'products' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects for update to authenticated
using (bucket_id = 'products' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (bucket_id = 'products' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects for delete to authenticated
using (bucket_id = 'products' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
