create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  category text not null check (category in ('Art de la table', 'Déco', 'Textile')),
  price numeric(10, 2) not null check (price > 0),
  tag text not null default '' check (char_length(tag) <= 40),
  image_url text not null check (image_url ~ '^https://'),
  alt text not null default '' check (char_length(alt) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  customer_email text not null check (char_length(customer_email) <= 254),
  customer_phone text not null check (char_length(trim(customer_phone)) between 6 and 40),
  delivery_address text not null check (char_length(trim(delivery_address)) between 8 and 500),
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 20)
);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to authenticated;

alter table public.products enable row level security;
alter table public.store_admins enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Anyone can view active products" on public.products;
create policy "Anyone can view active products"
  on public.products for select to anon, authenticated
  using (active or (select public.is_store_admin()));

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

drop policy if exists "Admins can view their admin record" on public.store_admins;
create policy "Admins can view their admin record"
  on public.store_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
  on public.orders for select to authenticated
  using ((select public.is_store_admin()));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));

drop policy if exists "Admins can view order items" on public.order_items;
create policy "Admins can view order items"
  on public.order_items for select to authenticated
  using ((select public.is_store_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.store_admins to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
create or replace function public.create_store_order(
  p_customer jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(10, 2) := 0;
begin
  if jsonb_typeof(p_customer) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Les informations de commande sont invalides.';
  end if;

  if char_length(trim(coalesce(p_customer ->> 'name', ''))) not between 1 and 120
     or char_length(trim(coalesce(p_customer ->> 'email', ''))) not between 3 and 254
     or (p_customer ->> 'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(trim(coalesce(p_customer ->> 'phone', ''))) not between 6 and 40
     or char_length(trim(coalesce(p_customer ->> 'address', ''))) not between 8 and 500 then
    raise exception 'Vérifiez le nom, l’adresse e-mail, le téléphone et l’adresse de livraison.';
  end if;

  insert into public.orders (
    customer_name,
    customer_email,
    customer_phone,
    delivery_address
  ) values (
    trim(p_customer ->> 'name'),
    lower(trim(p_customer ->> 'email')),
    trim(p_customer ->> 'phone'),
    trim(p_customer ->> 'address')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item ->> 'quantity', '') !~ '^[0-9]{1,2}$'
       or coalesce(v_item ->> 'product_id', '') !~* '^[0-9a-f-]{36}$' then
      raise exception 'Un article de la commande est invalide.';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity not between 1 and 20 then
      raise exception 'La quantité demandée est invalide.';
    end if;

    select * into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid and active
    for share;

    if not found then
      raise exception 'Un article n’est plus disponible.';
    end if;

    v_subtotal := v_subtotal + v_product.price * v_quantity;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_quantity);
  end loop;

  update public.orders set subtotal = v_subtotal where id = v_order_id;
  return v_order_id;
end;
$$;

revoke all on function public.create_store_order(jsonb, jsonb) from public;
grant execute on function public.create_store_order(jsonb, jsonb) to anon, authenticated;

insert into public.products (name, description, category, price, tag, image_url, alt)
values
  ('Vase Sable', 'Grès fait main · 24 cm', 'Déco', 42, 'FAIT À LA MAIN', 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=800&q=80', 'Vase en céramique artisanale aux tons naturels'),
  ('Carafe Ambre', 'Verre soufflé · 1 L', 'Art de la table', 36, 'COUP DE CŒUR', 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80', 'Carafe en verre ambré sur une table'),
  ('Coussin Lino', 'Lin lavé · 45 × 45 cm', 'Textile', 49, 'LIN NATUREL', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80', 'Coussin en lin naturel dans un intérieur lumineux'),
  ('Bol Terre', 'Céramique · fabriqué au Portugal', 'Art de la table', 24, '', 'https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=800&q=80', 'Bol en céramique aux couleurs terreuses'),
  ('Lampe Nuage', 'Papier & bois · 38 cm', 'Déco', 89, 'PETITE SÉRIE', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80', 'Lampe de table au design sculptural'),
  ('Plaid Douceur', 'Coton recyclé · 130 × 170 cm', 'Textile', 76, '', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80', 'Plaid doux posé sur un canapé'),
  ('Assiette Aube', 'Grès émaillé · pièce unique', 'Art de la table', 29, 'FAIT À LA MAIN', 'https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=800&q=80', 'Assiette artisanale en grès émaillé'),
  ('Bougeoir Olive', 'Céramique · fabriqué en France', 'Déco', 32, '', 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80', 'Bougie et objet décoratif dans une ambiance chaleureuse')
on conflict do nothing;

-- Après avoir créé le compte administrateur dans Supabase Auth, remplacer l'adresse :
-- insert into public.store_admins (user_id)
-- select id from auth.users where email = 'votre-email@example.com'
-- on conflict do nothing;
