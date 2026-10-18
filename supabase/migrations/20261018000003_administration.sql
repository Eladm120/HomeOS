-- =============================================================================
-- HomeOS — Phase 4: household administration
-- Appliances (+ maintenance), document vault (+ links, searchable text),
-- utility bills (provenance + review state), recurring charges, household
-- expenses, shared calendar, plants (+ care history).
--
-- Decisions:
-- * Invoices, manuals and bill PDFs are documents; appliances and bills point
--   at documents instead of storing their own files, so the vault is the one
--   place every file lives and can be searched.
-- * Bills keep provenance (source, import status, verified flag, raw extraction)
--   so parsed data is never presented as verified when it is not.
-- * Plants are watered through water_plant(), which also records history.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Document vault
-- ---------------------------------------------------------------------------
create table public.documents (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  category            text not null default 'other' check (category in
                        ('rental', 'insurance', 'warranty', 'invoice', 'utility_bill', 'maintenance', 'contract', 'receipt', 'medical', 'vehicle', 'tax', 'other')),
  tags                text[] not null default '{}' check (cardinality(tags) <= 20),
  file_path           text not null check (split_part(file_path, '/', 1) = household_id::text),
  file_name           text check (char_length(file_name) <= 200),
  mime_type           text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes          int check (size_bytes between 0 and 26214400),
  version             int not null default 1,
  previous_version_id uuid,
  issued_on           date,
  expires_on          date,
  remind_on           date,
  sensitive           boolean not null default false,
  extracted_text      text check (char_length(extracted_text) <= 200000),
  notes               text check (char_length(notes) <= 5000),
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, household_id),
  foreign key (previous_version_id, household_id) references public.documents (id, household_id) on delete set null (previous_version_id)
);
create index documents_household_idx on public.documents (household_id, category, created_at desc);
create index documents_expiry_idx on public.documents (household_id, expires_on) where expires_on is not null;
create index documents_search_idx on public.documents using gin ((coalesce(title, '') || ' ' || coalesce(extracted_text, '') || ' ' || coalesce(notes, '')) extensions.gin_trgm_ops);
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_links (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  document_id  uuid not null,
  entity_type  text not null check (entity_type in ('appliance', 'project', 'utility_bill', 'planned_purchase', 'event', 'plant')),
  entity_id    uuid not null,
  created_at   timestamptz not null default now(),
  unique (document_id, entity_type, entity_id),
  foreign key (document_id, household_id) references public.documents (id, household_id) on delete cascade
);
create index document_links_entity_idx on public.document_links (household_id, entity_type, entity_id);

/** Household-scoped document search (title, notes, extracted text, tags), Hebrew-friendly substring match. */
create or replace function public.search_documents(p_household uuid, p_query text)
returns table (id uuid, title text, category text, expires_on date, snippet text)
language sql stable security invoker set search_path = '' as $$
  select d.id, d.title, d.category, d.expires_on,
         case when d.extracted_text ilike '%' || p_query || '%'
              then substr(d.extracted_text, greatest(1, strpos(lower(d.extracted_text), lower(p_query)) - 60), 200)
         end
  from public.documents d
  where d.household_id = p_household
    and public.is_household_member(p_household)
    and (
      d.title ilike '%' || p_query || '%'
      or d.notes ilike '%' || p_query || '%'
      or d.extracted_text ilike '%' || p_query || '%'
      or exists (select 1 from unnest(d.tags) t where t ilike '%' || p_query || '%')
      or d.category = lower(p_query)
    )
  order by d.updated_at desc
  limit 20
$$;

-- ---------------------------------------------------------------------------
-- Appliances
-- ---------------------------------------------------------------------------
create table public.appliances (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 120),
  kind                text check (char_length(kind) <= 60),
  brand               text check (char_length(brand) <= 80),
  model               text check (char_length(model) <= 120),
  serial_number       text check (char_length(serial_number) <= 120),
  room_id             uuid,
  purchased_on        date,
  store               text check (char_length(store) <= 120),
  purchase_price      numeric(12, 2) check (purchase_price >= 0),
  currency            text not null default 'ILS',
  warranty_until      date,
  warranty_provider   text check (char_length(warranty_provider) <= 120),
  invoice_document_id uuid,
  manual_document_id  uuid,
  image_path          text,
  notes               text check (char_length(notes) <= 5000),
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, household_id),
  foreign key (room_id, household_id) references public.rooms (id, household_id) on delete set null (room_id),
  foreign key (invoice_document_id, household_id) references public.documents (id, household_id) on delete set null (invoice_document_id),
  foreign key (manual_document_id, household_id) references public.documents (id, household_id) on delete set null (manual_document_id)
);
create index appliances_warranty_idx on public.appliances (household_id, warranty_until) where warranty_until is not null;
create trigger appliances_updated_at before update on public.appliances
  for each row execute function public.set_updated_at();

create table public.appliance_maintenance (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  appliance_id uuid not null,
  kind         text not null default 'maintenance' check (kind in ('maintenance', 'repair', 'inspection', 'cleaning')),
  performed_on date not null default (now() at time zone 'Asia/Jerusalem')::date,
  description  text not null check (char_length(description) between 1 and 2000),
  cost         numeric(12, 2) check (cost >= 0),
  provider_id  uuid,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (appliance_id, household_id) references public.appliances (id, household_id) on delete cascade,
  foreign key (provider_id, household_id) references public.service_providers (id, household_id) on delete set null (provider_id)
);
create index appliance_maintenance_idx on public.appliance_maintenance (appliance_id, performed_on desc);

-- Repairs can point at the appliance they concern.
alter table public.home_projects add column appliance_id uuid;
alter table public.home_projects add constraint home_projects_appliance_fk
  foreign key (appliance_id, household_id) references public.appliances (id, household_id) on delete set null (appliance_id);

-- ---------------------------------------------------------------------------
-- Utility bills, recurring charges, expenses
-- ---------------------------------------------------------------------------
create table public.utility_bills (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  category         text not null check (category in ('electricity', 'water', 'arnona', 'gas', 'internet', 'building', 'insurance', 'other')),
  provider_name    text check (char_length(provider_name) <= 120),
  account_ref      text check (char_length(account_ref) <= 80),
  period_start     date,
  period_end       date,
  amount           numeric(12, 2) not null check (amount >= 0),
  currency         text not null default 'ILS',
  issue_date       date,
  due_on           date,
  paid_on          date,
  payment_status   text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'autopay')),
  consumption      numeric(14, 3) check (consumption >= 0),
  consumption_unit text check (char_length(consumption_unit) <= 20),
  fixed_charges    numeric(12, 2) check (fixed_charges >= 0),
  document_id      uuid,
  source           text not null default 'manual' check (source in ('manual', 'upload', 'email', 'api')),
  import_status    text not null default 'confirmed' check (import_status in ('needs_review', 'confirmed')),
  verified         boolean not null default true,
  extraction       jsonb,
  last_synced_at   timestamptz,
  notes            text check (char_length(notes) <= 2000),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, household_id),
  check (period_end is null or period_start is null or period_end >= period_start),
  foreign key (document_id, household_id) references public.documents (id, household_id) on delete set null (document_id)
);
create index utility_bills_household_idx on public.utility_bills (household_id, category, period_end desc);
create unique index utility_bills_dedupe_uq on public.utility_bills (household_id, category, coalesce(account_ref, ''), period_start, period_end, amount)
  where period_start is not null and period_end is not null;
create trigger utility_bills_updated_at before update on public.utility_bills
  for each row execute function public.set_updated_at();

create table public.recurring_charges (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  category     text not null default 'other' check (char_length(category) <= 40),
  amount       numeric(12, 2) not null check (amount >= 0),
  currency     text not null default 'ILS',
  frequency    text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'bimonthly', 'quarterly', 'yearly')),
  next_due_on  date,
  provider     text check (char_length(provider) <= 120),
  active       boolean not null default true,
  notes        text check (char_length(notes) <= 2000),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, household_id)
);
create trigger recurring_charges_updated_at before update on public.recurring_charges
  for each row execute function public.set_updated_at();

create table public.household_expenses (
  id                  uuid primary key default gen_random_uuid(),
  household_id        uuid not null references public.households (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 160),
  category            text not null default 'other' check (char_length(category) <= 40),
  amount              numeric(12, 2) not null check (amount >= 0),
  currency            text not null default 'ILS',
  spent_on            date not null default (now() at time zone 'Asia/Jerusalem')::date,
  recurring_charge_id uuid,
  notes               text check (char_length(notes) <= 2000),
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  foreign key (recurring_charge_id, household_id) references public.recurring_charges (id, household_id) on delete set null (recurring_charge_id)
);
create index household_expenses_idx on public.household_expenses (household_id, spent_on desc);

-- ---------------------------------------------------------------------------
-- Shared calendar
-- ---------------------------------------------------------------------------
create table public.household_events (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 160),
  description        text check (char_length(description) <= 3000),
  category           text not null default 'other' check (category in ('technician', 'delivery', 'guests', 'task', 'payment', 'maintenance', 'family', 'other')),
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  all_day            boolean not null default false,
  location           text check (char_length(location) <= 200),
  assignee_id        uuid,
  remind_minutes     int check (remind_minutes between 0 and 20160),
  linked_entity_type text check (linked_entity_type in ('project', 'appliance', 'chore', 'utility_bill', 'planned_purchase')),
  linked_entity_id   uuid,
  external_source    text check (external_source in ('google')),
  external_id        text check (char_length(external_id) <= 300),
  created_by         uuid default auth.uid() references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, household_id),
  check (ends_at is null or ends_at >= starts_at),
  foreign key (household_id, assignee_id) references public.household_memberships (household_id, user_id) on delete set null (assignee_id)
);
create index household_events_time_idx on public.household_events (household_id, starts_at);
create unique index household_events_external_uq on public.household_events (household_id, external_source, external_id) where external_id is not null;
create trigger household_events_updated_at before update on public.household_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Plants
-- ---------------------------------------------------------------------------
create table public.plants (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  name                   text not null check (char_length(name) between 1 and 80),
  species                text check (char_length(species) <= 120),
  room_id                uuid,
  location_note          text check (char_length(location_note) <= 120),
  image_path             text,
  watering_interval_days int not null default 7 check (watering_interval_days between 1 and 365),
  last_watered_on        date,
  light                  text check (light in ('low', 'medium', 'bright', 'direct')),
  notes                  text check (char_length(notes) <= 3000),
  identified_by_ai       boolean not null default false,
  ai_confidence          numeric(3, 2),
  created_by             uuid default auth.uid() references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, household_id),
  foreign key (room_id, household_id) references public.rooms (id, household_id) on delete set null (room_id)
);
create trigger plants_updated_at before update on public.plants
  for each row execute function public.set_updated_at();

create table public.plant_care_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plant_id     uuid not null,
  kind         text not null default 'water' check (kind in ('water', 'fertilize', 'repot', 'prune', 'note')),
  performed_on date not null default (now() at time zone 'Asia/Jerusalem')::date,
  note         text check (char_length(note) <= 500),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (plant_id, household_id) references public.plants (id, household_id) on delete cascade
);
create index plant_care_events_idx on public.plant_care_events (plant_id, performed_on desc);
-- watering is recorded once per plant per day
create unique index plant_water_once_per_day on public.plant_care_events (plant_id, performed_on) where kind = 'water';

create or replace function public.water_plant(p_plant uuid)
returns public.plants language plpgsql security definer set search_path = '' as $$
declare
  v_plant public.plants;
  v_today date;
begin
  select * into v_plant from public.plants where id = p_plant for update;
  if not found or not public.is_household_member(v_plant.household_id) then
    raise exception 'plant not found' using errcode = '42501';
  end if;
  select (now() at time zone h.timezone)::date into v_today from public.households h where h.id = v_plant.household_id;
  insert into public.plant_care_events (household_id, plant_id, kind, performed_on, created_by)
  values (v_plant.household_id, v_plant.id, 'water', v_today, auth.uid())
  on conflict do nothing;
  update public.plants set last_watered_on = v_today where id = v_plant.id returning * into v_plant;
  perform public.log_activity(v_plant.household_id, 'plant', v_plant.id, 'watered', jsonb_build_object('name', v_plant.name));
  return v_plant;
end $$;
revoke execute on function public.water_plant(uuid) from public, anon;
grant execute on function public.water_plant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create trigger appliances_audit after insert or delete on public.appliances
  for each row execute function public.audit_row('appliance', 'name');
create trigger documents_audit after insert or delete on public.documents
  for each row execute function public.audit_row('document', 'title');
create trigger utility_bills_audit after insert on public.utility_bills
  for each row execute function public.audit_row('utility_bill', 'provider_name');
create trigger household_events_audit after insert on public.household_events
  for each row execute function public.audit_row('event', 'title');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'documents', 'document_links', 'appliances', 'appliance_maintenance', 'utility_bills',
    'recurring_charges', 'household_expenses', 'household_events', 'plants', 'plant_care_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t);
  end loop;
end $$;

-- Sensitive documents: only the uploader may delete them or clear the flag.
drop policy documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated
  using (public.is_household_member(household_id) and (not sensitive or created_by = auth.uid()));

revoke execute on function public.search_documents(uuid, text) from public, anon;
grant execute on function public.search_documents(uuid, text) to authenticated;

alter publication supabase_realtime add table public.household_events;
alter publication supabase_realtime add table public.utility_bills;

-- ---------------------------------------------------------------------------
-- Suggestion engine, extended with the administration modules
-- ---------------------------------------------------------------------------
create or replace function public.generate_admin_suggestions(p_household uuid, v_today date)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_seen text[] := '{}';
  v_avg numeric;
begin
  -- Warranty ending within 30 days
  for r in select id, name, warranty_until from public.appliances
           where household_id = p_household and warranty_until between v_today and v_today + 30 loop
    perform public.upsert_suggestion(p_household, 'warranty', 'warranty:' || r.id || ':' || r.warranty_until,
      'האחריות של ' || r.name || ' מסתיימת בעוד ' || (r.warranty_until - v_today) || ' ימים',
      'כדאי לבדוק עכשיו אם יש משהו לתקן במסגרת האחריות.', 'normal', '/appliances/' || r.id, null,
      jsonb_build_array(jsonb_build_object('type', 'appliance', 'id', r.id)), 1, (r.warranty_until + 1)::timestamptz);
    v_seen := v_seen || ('warranty:' || r.id || ':' || r.warranty_until);
  end loop;

  -- Unpaid bills due within 5 days (or overdue)
  for r in select id, category, provider_name, amount, due_on from public.utility_bills
           where household_id = p_household and payment_status = 'unpaid' and due_on is not null and due_on <= v_today + 5 loop
    perform public.upsert_suggestion(p_household, 'bill_due', 'bill_due:' || r.id,
      case when r.due_on < v_today then 'חשבון שמועד התשלום שלו עבר: ' else 'חשבון לתשלום עד ' || to_char(r.due_on, 'DD/MM') || ': ' end
        || coalesce(r.provider_name, r.category) || ' ₪' || r.amount,
      null, case when r.due_on < v_today then 'high'::public.item_priority else 'normal'::public.item_priority end,
      '/bills/' || r.id, null, jsonb_build_array(jsonb_build_object('type', 'utility_bill', 'id', r.id)), 1, null);
    v_seen := v_seen || ('bill_due:' || r.id);
  end loop;

  -- Latest bill per category far above the household's own daily average (per day, so period length does not mislead)
  for r in
    select distinct on (b.category) b.id, b.category, b.provider_name, b.amount, b.period_start, b.period_end
    from public.utility_bills b
    where b.household_id = p_household and b.period_start is not null and b.period_end is not null
      and b.period_end >= v_today - 120
    order by b.category, b.period_end desc
  loop
    select avg(p.amount / greatest(1, p.period_end - p.period_start + 1)) into v_avg
    from (select * from public.utility_bills
          where household_id = p_household and category = r.category and id <> r.id
            and period_start is not null and period_end is not null and period_end < r.period_end
          order by period_end desc limit 3) p;
    if v_avg is not null and v_avg > 0
       and (r.amount / greatest(1, r.period_end - r.period_start + 1)) > v_avg * 1.25 then
      perform public.upsert_suggestion(p_household, 'bill_unusual', 'bill_unusual:' || r.id,
        'חשבון ' || coalesce(r.provider_name, r.category) || ' גבוה מהרגיל',
        'בממוצע ליום, החשבון האחרון גבוה ביותר מ-25% מהחשבונות הקודמים. פתחו את ההשוואה כדי לראות אם זו צריכה, מחיר או חיוב חד פעמי.',
        'normal', '/bills/' || r.id, null, jsonb_build_array(jsonb_build_object('type', 'utility_bill', 'id', r.id)), 0.8, (v_today + 30)::timestamptz);
      v_seen := v_seen || ('bill_unusual:' || r.id);
    end if;
  end loop;

  -- Documents expiring within 30 days
  for r in select id, title, expires_on from public.documents
           where household_id = p_household and expires_on between v_today and v_today + 30 loop
    perform public.upsert_suggestion(p_household, 'document_expiry', 'document_expiry:' || r.id || ':' || r.expires_on,
      r.title || ' מסתיים ב-' || to_char(r.expires_on, 'DD/MM/YYYY'), 'כדאי לחדש או לבדוק תנאים לפני התאריך.',
      'normal', '/documents/' || r.id, null, jsonb_build_array(jsonb_build_object('type', 'document', 'id', r.id)), 1, (r.expires_on + 1)::timestamptz);
    v_seen := v_seen || ('document_expiry:' || r.id || ':' || r.expires_on);
  end loop;

  -- Plants that need water
  for r in select id, name, last_watered_on, watering_interval_days from public.plants
           where household_id = p_household and (last_watered_on is null or last_watered_on + watering_interval_days <= v_today) loop
    perform public.upsert_suggestion(p_household, 'plant_water', 'plant_water:' || r.id || ':' || coalesce(r.last_watered_on::text, 'never'),
      'להשקות את ' || r.name, null, 'low', '/plants/' || r.id, jsonb_build_object('type', 'water_plant', 'plant_id', r.id),
      jsonb_build_array(jsonb_build_object('type', 'plant', 'id', r.id)), 0.9, null);
    v_seen := v_seen || ('plant_water:' || r.id || ':' || coalesce(r.last_watered_on::text, 'never'));
  end loop;

  update public.ai_suggestions set status = 'expired'
  where household_id = p_household and status = 'active'
    and kind in ('warranty', 'bill_due', 'bill_unusual', 'document_expiry', 'plant_water')
    and not (dedupe_key = any (v_seen));
  return v_seen;
end $$;
revoke execute on function public.generate_admin_suggestions(uuid, date) from public, anon, authenticated;

-- Wrap the Phase 3 engine so both run together.
alter function public.generate_suggestions(uuid) rename to generate_core_suggestions;
revoke execute on function public.generate_core_suggestions(uuid) from public, anon, authenticated;

create or replace function public.generate_suggestions(p_household uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
  v_today date;
begin
  v_n := public.generate_core_suggestions(p_household);
  select (now() at time zone timezone)::date into v_today from public.households where id = p_household;
  perform public.generate_admin_suggestions(p_household, v_today);
  return v_n;
end $$;
revoke execute on function public.generate_suggestions(uuid) from public, anon;
grant execute on function public.generate_suggestions(uuid) to authenticated;
