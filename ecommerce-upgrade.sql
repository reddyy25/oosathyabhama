-- =====================================================================================
-- Oo_Sathyabhama – E-commerce upgrade (ADDITIVE ONLY)
-- Run ONCE in Supabase > SQL Editor. Safe to run again (every statement is idempotent).
-- Nothing is dropped or renamed, no product/order rows are changed, existing policies are kept.
-- The website works WITHOUT this file; running it switches on categories, stock, payment
-- tracking, the new order statuses and payment-proof screenshots.
-- =====================================================================================

-- 1) Optional product fields (empty stock = "not tracked", product stays buyable) -----
alter table public.products add column if not exists category text;
alter table public.products add column if not exists stock integer check (stock is null or stock >= 0);

-- 2) Payment tracking on orders ------------------------------------------------------
alter table public.orders
  add column if not exists payment_method text,            -- 'upi' or 'whatsapp'
  add column if not exists payment_status text,            -- 'unpaid' -> 'submitted' (admin confirms by changing order status)
  add column if not exists payment_utr text,               -- transaction id typed by the customer (NOT proof by itself)
  add column if not exists payment_proof_path text,        -- screenshot in the private 'payment-proofs' bucket
  add column if not exists payment_submitted_at timestamptz;

-- 3) Allow the new order statuses ----------------------------------------------------
-- pending, payment_verification, confirmed, processing (kept), shipped, delivered, cancelled
do $$
declare
  col_schema text; col_type text; is_enum boolean; r record; v text;
  statuses text[] := array['pending','payment_verification','confirmed','processing','shipped','delivered','cancelled'];
begin
  select c.udt_schema, c.udt_name into col_schema, col_type
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'orders' and c.column_name = 'status';
  if col_type is null then
    raise notice 'orders.status not found - status step skipped';
    return;
  end if;
  select exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = col_type and n.nspname = col_schema and t.typtype = 'e') into is_enum;
  if is_enum then
    foreach v in array statuses loop
      execute format('alter type %I.%I add value if not exists %L', col_schema, col_type, v);
    end loop;
  else
    -- replace any old CHECK on status with one that includes the new values (existing rows are not re-checked)
    for r in select conname from pg_constraint
             where conrelid = 'public.orders'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
      execute format('alter table public.orders drop constraint %I', r.conname);
    end loop;
    alter table public.orders add constraint orders_status_check
      check (status in ('pending','payment_verification','confirmed','processing','shipped','delivered','cancelled')) not valid;
  end if;
end $$;

-- 4) Customers submit their UTR through ONE narrow function (no public UPDATE on orders) ----
create or replace function public.submit_payment_proof(p_order_id uuid, p_utr text, p_proof_path text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_utr is null or p_utr !~ '^[A-Za-z0-9]{8,35}$' then
    raise exception 'Invalid transaction reference';
  end if;
  if p_proof_path is not null and (length(p_proof_path) > 200 or p_proof_path !~ ('^' || p_order_id::text || '/[A-Za-z0-9._-]+$')) then
    p_proof_path := null;
  end if;
  update public.orders
     set payment_utr = p_utr,
         payment_proof_path = coalesce(p_proof_path, payment_proof_path),
         payment_submitted_at = now(),
         payment_status = 'submitted',
         status = 'payment_verification'
   where id = p_order_id and status in ('pending', 'payment_verification');
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.submit_payment_proof(uuid, text, text) from public;
grant execute on function public.submit_payment_proof(uuid, text, text) to anon, authenticated;

-- 5) Private bucket for payment screenshots (customers can upload, only admins can view) ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "Customers can upload payment proofs" on storage.objects;
create policy "Customers can upload payment proofs"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'payment-proofs');

drop policy if exists "Admins can view payment proofs" on storage.objects;
create policy "Admins can view payment proofs"
on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- 6) OPTIONAL hardening – do NOT run until SUPABASE_SERVICE_ROLE_KEY is set in Vercel and a
--    test order has worked. It stops anyone inserting orders directly with their own prices.
--    (The "local preview" fallback in the browser will then stop working, which is intended.)
-- drop policy if exists "Anyone can submit an order" on public.orders;
