-- =============================================================================
-- HomeOS — Phase 1 foundation
-- Identity, households, membership, invitations, rooms, catalog, grocery,
-- inventory (movement-based), activity log, storage, realtime.
--
-- Tenant model: every household-owned row carries household_id. Access is
-- granted exclusively through household_memberships, enforced by RLS.
-- Cross-table tenant integrity is enforced with composite foreign keys
-- (child.household_id must equal parent.household_id).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.household_role as enum ('owner', 'member');
create type public.shopping_item_status as enum ('pending', 'purchased', 'unavailable');
create type public.item_priority as enum ('low', 'normal', 'high');
create type public.inventory_movement_kind as enum
  ('initial', 'add', 'purchase', 'consume', 'correct', 'discard', 'transfer');
create type public.stock_confidence as enum ('confirmed', 'estimated');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  avatar_path  text,
  locale       text not null default 'he',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''),
                  split_part(new.email, '@', 1), ''), 60)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Households & membership
-- ---------------------------------------------------------------------------
create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  timezone   text not null default 'Asia/Jerusalem',
  currency   text not null default 'ILS',
  locale     text not null default 'he',
  settings   jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();

create table public.household_memberships (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.household_role not null default 'member',
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);
create index household_memberships_user_idx on public.household_memberships (user_id);

create table public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email        text check (email is null or email = lower(email)),
  role         public.household_role not null default 'member',
  token_hash   text not null unique,
  invited_by   uuid references auth.users (id) on delete set null,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index household_invitations_household_idx on public.household_invitations (household_id);

-- Authorization helpers. SECURITY DEFINER so RLS policies can call them without
-- recursing into household_memberships' own policies.
create or replace function public.is_household_member(p_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_memberships m
    where m.household_id = p_household and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(p_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_memberships m
    where m.household_id = p_household and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.shares_household_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.household_memberships a
    join public.household_memberships b on b.household_id = a.household_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Rooms, categories, storage locations
-- ---------------------------------------------------------------------------
create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  icon         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);
create trigger rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

create table public.product_categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  icon         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);
create trigger product_categories_updated_at before update on public.product_categories
  for each row execute function public.set_updated_at();

create table public.inventory_locations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  icon         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (household_id, name),
  unique (id, household_id)
);
create trigger inventory_locations_updated_at before update on public.inventory_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Household product catalog (reusable names, brands, barcodes, photos)
-- ---------------------------------------------------------------------------
create table public.product_catalog (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  brand        text check (char_length(brand) <= 80),
  variant      text check (char_length(variant) <= 80),
  barcode      text check (barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  category_id  uuid,
  default_unit text not null default 'יח׳',
  image_path   text,
  notes        text check (char_length(notes) <= 1000),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, household_id),
  foreign key (category_id, household_id)
    references public.product_categories (id, household_id) on delete set null (category_id)
);
create unique index product_catalog_barcode_uq
  on public.product_catalog (household_id, barcode) where barcode is not null;
create index product_catalog_name_idx on public.product_catalog (household_id, lower(name));
create trigger product_catalog_updated_at before update on public.product_catalog
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory (quantity is a cache maintained ONLY by inventory_apply_movement)
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  catalog_product_id uuid,
  name               text not null check (char_length(name) between 1 and 120),
  brand              text check (char_length(brand) <= 80),
  barcode            text check (barcode ~ '^[0-9A-Za-z-]{4,32}$'),
  category_id        uuid,
  location_id        uuid,
  unit               text not null default 'יח׳' check (char_length(unit) <= 20),
  quantity           numeric(12, 3) not null default 0 check (quantity >= 0),
  min_threshold      numeric(12, 3) check (min_threshold >= 0),
  restock_quantity   numeric(12, 3) check (restock_quantity > 0),
  expires_on         date,
  image_path         text,
  notes              text check (char_length(notes) <= 1000),
  stock_confidence   public.stock_confidence not null default 'confirmed',
  last_verified_at   timestamptz,
  last_purchased_at  timestamptz,
  last_movement_at   timestamptz,
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  archived_at        timestamptz,
  unique (id, household_id),
  foreign key (catalog_product_id, household_id)
    references public.product_catalog (id, household_id) on delete set null (catalog_product_id),
  foreign key (category_id, household_id)
    references public.product_categories (id, household_id) on delete set null (category_id),
  foreign key (location_id, household_id)
    references public.inventory_locations (id, household_id) on delete set null (location_id)
);
create index inventory_items_household_idx on public.inventory_items (household_id) where archived_at is null;
create index inventory_items_expiry_idx on public.inventory_items (household_id, expires_on)
  where archived_at is null and expires_on is not null;
create index inventory_items_barcode_idx on public.inventory_items (household_id, barcode) where barcode is not null;
create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  item_id          uuid not null,
  kind             public.inventory_movement_kind not null,
  quantity_delta   numeric(12, 3) not null,
  quantity_after   numeric(12, 3) not null,
  from_location_id uuid,
  to_location_id   uuid,
  source           text not null default 'manual' check (source in ('manual', 'grocery', 'receipt', 'recipe', 'system')),
  source_ref       text,
  note             text check (char_length(note) <= 500),
  idempotency_key  text,
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  foreign key (item_id, household_id)
    references public.inventory_items (id, household_id) on delete cascade,
  unique (household_id, idempotency_key)
);
create index inventory_movements_item_idx on public.inventory_movements (item_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grocery shopping
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, household_id)
);
create unique index shopping_lists_default_uq on public.shopping_lists (household_id) where is_default;
create trigger shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  list_id            uuid not null,
  catalog_product_id uuid,
  inventory_item_id  uuid,
  category_id        uuid,
  name               text not null check (char_length(name) between 1 and 120),
  quantity           numeric(12, 3) not null default 1 check (quantity > 0),
  unit               text not null default 'יח׳' check (char_length(unit) <= 20),
  brand              text check (char_length(brand) <= 80),
  variant            text check (char_length(variant) <= 80),
  notes              text check (char_length(notes) <= 1000),
  priority           public.item_priority not null default 'normal',
  status             public.shopping_item_status not null default 'pending',
  image_path         text,
  added_by           uuid default auth.uid() references auth.users (id) on delete set null,
  purchased_by       uuid references auth.users (id) on delete set null,
  purchased_at       timestamptz,
  cleared_at         timestamptz,          -- removed from the active list after a trip (history kept)
  deleted_at         timestamptz,          -- soft delete
  version            int not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (list_id, household_id)
    references public.shopping_lists (id, household_id) on delete cascade,
  foreign key (catalog_product_id, household_id)
    references public.product_catalog (id, household_id) on delete set null (catalog_product_id),
  foreign key (inventory_item_id, household_id)
    references public.inventory_items (id, household_id) on delete set null (inventory_item_id),
  foreign key (category_id, household_id)
    references public.product_categories (id, household_id) on delete set null (category_id)
);
create index shopping_list_items_active_idx on public.shopping_list_items (household_id, list_id)
  where deleted_at is null and cleared_at is null;

create or replace function public.bump_version()
returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  if new.status = 'purchased' and old.status is distinct from 'purchased' then
    new.purchased_at := coalesce(new.purchased_at, now());
    new.purchased_by := coalesce(new.purchased_by, auth.uid());
  elsif new.status <> 'purchased' then
    new.purchased_at := null;
    new.purchased_by := null;
  end if;
  return new;
end $$;
create trigger shopping_list_items_version before update on public.shopping_list_items
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------------------
-- Activity log (audit trail for important actions)
-- ---------------------------------------------------------------------------
create table public.activity_events (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id     uuid references auth.users (id) on delete set null,
  entity_type  text not null,
  entity_id    uuid,
  action       text not null,
  summary      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index activity_events_household_idx on public.activity_events (household_id, created_at desc);

create or replace function public.log_activity(
  p_household uuid, p_entity_type text, p_entity_id uuid, p_action text, p_summary jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.activity_events (household_id, actor_id, entity_type, entity_id, action, summary)
  values (p_household, auth.uid(), p_entity_type, p_entity_id, p_action, coalesce(p_summary, '{}'::jsonb));
$$;

create or replace function public.audit_shopping_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.household_id, 'shopping_item', new.id, 'created',
      jsonb_build_object('name', new.name));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.household_id, 'shopping_item', new.id, 'deleted',
      jsonb_build_object('name', new.name));
  elsif new.status is distinct from old.status then
    perform public.log_activity(new.household_id, 'shopping_item', new.id, 'status_changed',
      jsonb_build_object('name', new.name, 'from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger shopping_list_items_audit after insert or update on public.shopping_list_items
  for each row execute function public.audit_shopping_item();

create or replace function public.audit_inventory_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.household_id, 'inventory_item', new.id, 'created',
      jsonb_build_object('name', new.name));
  elsif tg_op = 'DELETE' then
    perform public.log_activity(old.household_id, 'inventory_item', old.id, 'deleted',
      jsonb_build_object('name', old.name));
    return old;
  elsif new.archived_at is not null and old.archived_at is null then
    perform public.log_activity(new.household_id, 'inventory_item', new.id, 'archived',
      jsonb_build_object('name', new.name));
  end if;
  return new;
end $$;
create trigger inventory_items_audit after insert or update or delete on public.inventory_items
  for each row execute function public.audit_inventory_item();

-- ---------------------------------------------------------------------------
-- RPC: create household (atomic bootstrap with sensible Hebrew defaults)
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_name text, p_rooms text[] default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_household uuid;
  v_rooms text[] := coalesce(p_rooms, array['סלון', 'מטבח', 'חדר שינה', 'חדר עבודה', 'חדר רחצה', 'מרפסת']);
  v_i int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'household name required' using errcode = '22023';
  end if;

  insert into public.households (name, created_by) values (trim(p_name), v_uid)
  returning id into v_household;

  insert into public.household_memberships (household_id, user_id, role)
  values (v_household, v_uid, 'owner');

  for v_i in 1 .. coalesce(array_length(v_rooms, 1), 0) loop
    if char_length(trim(v_rooms[v_i])) > 0 then
      insert into public.rooms (household_id, name, sort_order)
      values (v_household, trim(v_rooms[v_i]), v_i)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.product_categories (household_id, name, icon, sort_order)
  select v_household, c.name, c.icon, c.ord
  from (values
    ('פירות וירקות', 'apple', 1), ('מוצרי חלב', 'milk', 2), ('בשר ודגים', 'beef', 3),
    ('מאפים ולחם', 'croissant', 4), ('קפואים', 'snowflake', 5), ('מזווה', 'wheat', 6),
    ('משקאות', 'cup-soda', 7), ('ניקיון', 'spray-can', 8), ('טואלטיקה', 'bath', 9),
    ('מוצרים לבית', 'house', 10), ('אחר', 'package', 11)
  ) as c(name, icon, ord);

  insert into public.inventory_locations (household_id, name, icon, sort_order)
  select v_household, l.name, l.icon, l.ord
  from (values
    ('מקרר', 'refrigerator', 1), ('מקפיא', 'snowflake', 2), ('מזווה', 'archive', 3),
    ('ארונות מטבח', 'door-closed', 4), ('חדר רחצה', 'bath', 5), ('ארון ניקיון', 'spray-can', 6),
    ('פינת כביסה', 'washing-machine', 7)
  ) as l(name, icon, ord);

  insert into public.shopping_lists (household_id, name, is_default)
  values (v_household, 'סופר', true);

  perform public.log_activity(v_household, 'household', v_household, 'created',
    jsonb_build_object('name', trim(p_name)));

  return v_household;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: invitations (token is returned once; only its SHA-256 is stored)
-- ---------------------------------------------------------------------------
create or replace function public.create_household_invitation(p_household uuid, p_email text default null)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_id uuid;
  v_exp timestamptz;
begin
  if not public.is_household_owner(p_household) then
    raise exception 'only household owners can invite' using errcode = '42501';
  end if;

  insert into public.household_invitations (household_id, email, token_hash, invited_by)
  values (
    p_household,
    nullif(lower(trim(p_email)), ''),
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    auth.uid()
  )
  returning id, household_invitations.expires_at into v_id, v_exp;

  perform public.log_activity(p_household, 'invitation', v_id, 'created',
    jsonb_build_object('email', nullif(lower(trim(p_email)), '')));

  return query select v_id, v_token, v_exp;
end $$;

create or replace function public.get_invitation_preview(p_token text)
returns table (household_name text, inviter_name text, is_valid boolean, email text)
language sql stable security definer set search_path = '' as $$
  select h.name,
         p.display_name,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now()),
         i.email
  from public.household_invitations i
  join public.households h on h.id = i.household_id
  left join public.profiles p on p.id = i.invited_by
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.accept_household_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv public.household_invitations;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.household_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation is invalid or expired' using errcode = '22023';
  end if;

  if exists (select 1 from public.household_memberships
             where household_id = v_inv.household_id and user_id = v_uid) then
    return v_inv.household_id;  -- idempotent
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'invitation already used' using errcode = '22023';
  end if;

  if v_inv.email is not null and v_inv.email <> v_email then
    raise exception 'invitation was issued for a different email' using errcode = '42501';
  end if;

  insert into public.household_memberships (household_id, user_id, role)
  values (v_inv.household_id, v_uid, v_inv.role);

  update public.household_invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  perform public.log_activity(v_inv.household_id, 'membership', v_uid, 'joined', '{}'::jsonb);
  return v_inv.household_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: inventory movement (the ONLY way quantities change)
-- Locks the item row, computes the delta, writes an auditable movement,
-- updates the cached quantity. Idempotent per (household, idempotency_key).
-- ---------------------------------------------------------------------------
create or replace function public.inventory_apply_movement(
  p_item_id         uuid,
  p_kind            public.inventory_movement_kind,
  p_quantity        numeric,
  p_note            text default null,
  p_to_location     uuid default null,
  p_idempotency_key text default null,
  p_source          text default 'manual',
  p_source_ref      text default null
) returns public.inventory_items
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.inventory_items;
  v_delta numeric(12, 3);
  v_after numeric(12, 3);
begin
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found or not public.is_household_member(v_item.household_id) then
    raise exception 'item not found' using errcode = '42501';
  end if;

  if p_idempotency_key is not null and exists (
    select 1 from public.inventory_movements
    where household_id = v_item.household_id and idempotency_key = p_idempotency_key
  ) then
    return v_item;  -- already applied
  end if;

  if p_kind <> 'transfer' and (p_quantity is null or p_quantity < 0) then
    raise exception 'quantity must be non-negative' using errcode = '22023';
  end if;

  case p_kind
    when 'initial', 'add', 'purchase' then v_delta := p_quantity;
    when 'consume', 'discard'         then v_delta := -least(p_quantity, v_item.quantity);
    when 'correct'                    then v_delta := p_quantity - v_item.quantity;
    when 'transfer'                   then v_delta := 0;
  end case;
  v_after := v_item.quantity + v_delta;

  if p_kind = 'transfer' then
    if p_to_location is null or not exists (
      select 1 from public.inventory_locations
      where id = p_to_location and household_id = v_item.household_id
    ) then
      raise exception 'invalid target location' using errcode = '22023';
    end if;
  end if;

  insert into public.inventory_movements (
    household_id, item_id, kind, quantity_delta, quantity_after,
    from_location_id, to_location_id, source, source_ref, note, idempotency_key, created_by
  ) values (
    v_item.household_id, v_item.id, p_kind, v_delta, v_after,
    v_item.location_id, case when p_kind = 'transfer' then p_to_location end,
    coalesce(p_source, 'manual'), p_source_ref, p_note, p_idempotency_key, auth.uid()
  );

  update public.inventory_items set
    quantity          = v_after,
    location_id       = case when p_kind = 'transfer' then p_to_location else location_id end,
    last_movement_at  = now(),
    last_purchased_at = case when p_kind = 'purchase' then now() else last_purchased_at end,
    last_verified_at  = case when p_kind in ('initial', 'correct') then now() else last_verified_at end,
    stock_confidence  = case
                          when p_kind in ('initial', 'correct') then 'confirmed'::public.stock_confidence
                          -- consumed more than we believed we had: the record was off
                          when p_kind in ('consume', 'discard') and p_quantity > v_item.quantity
                            then 'estimated'::public.stock_confidence
                          else stock_confidence
                        end
  where id = v_item.id
  returning * into v_item;

  return v_item;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.households             enable row level security;
alter table public.household_memberships  enable row level security;
alter table public.household_invitations  enable row level security;
alter table public.rooms                  enable row level security;
alter table public.product_categories     enable row level security;
alter table public.inventory_locations    enable row level security;
alter table public.product_catalog        enable row level security;
alter table public.inventory_items        enable row level security;
alter table public.inventory_movements    enable row level security;
alter table public.shopping_lists         enable row level security;
alter table public.shopping_list_items    enable row level security;
alter table public.activity_events        enable row level security;

-- profiles: see yourself and people you share a household with; edit yourself.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- households: created only via create_household(); owners manage.
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_household_owner(id));

-- memberships: visible to co-members; owners manage; members may leave.
create policy memberships_select on public.household_memberships for select to authenticated
  using (public.is_household_member(household_id));
create policy memberships_update on public.household_memberships for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy memberships_delete on public.household_memberships for delete to authenticated
  using (public.is_household_owner(household_id) or user_id = auth.uid());

-- invitations: owners only (creation and acceptance go through RPCs).
create policy invitations_select on public.household_invitations for select to authenticated
  using (public.is_household_owner(household_id));
create policy invitations_update on public.household_invitations for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));

-- Standard household-scoped CRUD for shared data.
do $$
declare t text;
begin
  foreach t in array array[
    'rooms', 'product_categories', 'inventory_locations', 'product_catalog',
    'inventory_items', 'shopping_lists', 'shopping_list_items'
  ] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t);
  end loop;
end $$;

-- Movements and activity are append-only via security-definer functions.
create policy inventory_movements_select on public.inventory_movements for select to authenticated
  using (public.is_household_member(household_id));
create policy activity_events_select on public.activity_events for select to authenticated
  using (public.is_household_member(household_id));

-- Quantity may never be written directly by clients.
revoke insert, update on public.inventory_items from anon, authenticated;
grant insert (
  household_id, catalog_product_id, name, brand, barcode, category_id, location_id, unit,
  min_threshold, restock_quantity, expires_on, image_path, notes
) on public.inventory_items to authenticated;
grant update (
  catalog_product_id, name, brand, barcode, category_id, unit,
  min_threshold, restock_quantity, expires_on, image_path, notes, archived_at
) on public.inventory_items to authenticated;

-- Version/purchase bookkeeping is server-maintained.
revoke update on public.shopping_list_items from anon, authenticated;
grant update (
  catalog_product_id, inventory_item_id, category_id, name, quantity, unit, brand, variant,
  notes, priority, status, image_path, cleared_at, deleted_at
) on public.shopping_list_items to authenticated;

revoke insert, update, delete on public.inventory_movements from anon, authenticated;
revoke insert, update, delete on public.activity_events from anon, authenticated;
revoke all on public.household_invitations from anon;

-- Function execution grants (functions default to PUBLIC execute).
revoke execute on function public.create_household(text, text[]) from public, anon;
revoke execute on function public.create_household_invitation(uuid, text) from public, anon;
revoke execute on function public.accept_household_invitation(text) from public, anon;
revoke execute on function public.inventory_apply_movement(uuid, public.inventory_movement_kind, numeric, text, uuid, text, text, text) from public, anon;
revoke execute on function public.log_activity(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.get_invitation_preview(text) from public;
grant execute on function public.create_household(text, text[]) to authenticated;
grant execute on function public.create_household_invitation(uuid, text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.inventory_apply_movement(uuid, public.inventory_movement_kind, numeric, text, uuid, text, text, text) to authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, path = {household_id}/{module}/{file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('household-media', 'household-media', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

create policy household_media_select on storage.objects for select to authenticated
  using (bucket_id = 'household-media'
         and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));
create policy household_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'household-media'
              and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));
create policy household_media_update on storage.objects for update to authenticated
  using (bucket_id = 'household-media'
         and public.is_household_member(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'household-media'
              and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));
create policy household_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'household-media'
         and public.is_household_member(public.try_uuid((storage.foldername(name))[1])));

-- ---------------------------------------------------------------------------
-- Realtime (postgres_changes respects RLS)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.shopping_list_items;
alter publication supabase_realtime add table public.inventory_items;
