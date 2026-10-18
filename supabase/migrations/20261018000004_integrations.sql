-- =============================================================================
-- HomeOS — Phase 5: integrations
-- Integration connections (Home Assistant, Google Calendar, Gmail bill import),
-- smart-home device cache, an honest device command log, simple device
-- automations, and a sync log that makes every import idempotent.
--
-- Secrets: access/refresh tokens are encrypted by the server (AES-256-GCM with a
-- key that exists only in the server environment) before they reach the
-- database. Clients can never read the ciphertext column; the server reads it
-- through a member-checked RPC. Even a leaked ciphertext is useless without the
-- server key.
-- =============================================================================

create table public.integration_connections (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  provider          text not null check (provider in ('home_assistant', 'google_calendar', 'gmail')),
  status            text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error')),
  -- non-secret settings only (base URL, calendar id, account email, scopes)
  config            jsonb not null default '{}'::jsonb,
  secret_ciphertext text,
  last_sync_at      timestamptz,
  last_error        text check (char_length(last_error) <= 500),
  connected_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (household_id, provider),
  unique (id, household_id)
);
create trigger integration_connections_updated_at before update on public.integration_connections
  for each row execute function public.set_updated_at();

create table public.smart_home_devices (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  connection_id         uuid not null,
  entity_id             text not null check (entity_id ~ '^[a-z_]+\.[a-z0-9_]+$'),
  name                  text not null check (char_length(name) between 1 and 120),
  kind                  text not null check (kind in ('climate', 'water_heater', 'switch', 'light', 'sensor', 'binary_sensor', 'other')),
  room_id               uuid,
  online                boolean not null default true,
  state                 text,
  attributes            jsonb not null default '{}'::jsonb,
  capabilities          jsonb not null default '{}'::jsonb,
  pinned                boolean not null default false,
  requires_confirmation boolean not null default false,
  state_updated_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (household_id, entity_id),
  unique (id, household_id),
  foreign key (connection_id, household_id) references public.integration_connections (id, household_id) on delete cascade,
  foreign key (room_id, household_id) references public.rooms (id, household_id) on delete set null (room_id)
);
create trigger smart_home_devices_updated_at before update on public.smart_home_devices
  for each row execute function public.set_updated_at();

create table public.device_command_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  device_id    uuid not null,
  command      text not null check (char_length(command) <= 80),
  params       jsonb not null default '{}'::jsonb,
  requested_by uuid default auth.uid() references auth.users (id) on delete set null,
  via          text not null default 'app' check (via in ('app', 'assistant', 'automation')),
  status       text not null check (status in ('sent', 'succeeded', 'failed', 'unconfirmed')),
  detail       text check (char_length(detail) <= 500),
  created_at   timestamptz not null default now(),
  foreign key (device_id, household_id) references public.smart_home_devices (id, household_id) on delete cascade
);
create index device_command_log_idx on public.device_command_log (household_id, created_at desc);

create table public.home_automations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  device_id     uuid not null,
  kind          text not null check (kind in ('auto_off', 'offline_alert')),
  after_minutes int check (after_minutes between 1 and 1440),
  enabled       boolean not null default true,
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (device_id, kind),
  foreign key (device_id, household_id) references public.smart_home_devices (id, household_id) on delete cascade
);

-- Imported external items (Google events, Gmail messages) — makes re-sync idempotent.
create table public.integration_sync_log (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  provider     text not null,
  external_id  text not null check (char_length(external_id) <= 300),
  entity_type  text,
  entity_id    uuid,
  outcome      text not null check (outcome in ('imported', 'skipped', 'failed')),
  detail       text check (char_length(detail) <= 500),
  created_at   timestamptz not null default now(),
  unique (household_id, provider, external_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.integration_connections enable row level security;
alter table public.smart_home_devices      enable row level security;
alter table public.device_command_log      enable row level security;
alter table public.home_automations        enable row level security;
alter table public.integration_sync_log    enable row level security;

-- Connections: members see status; only owners connect, change or remove them.
create policy integration_connections_select on public.integration_connections for select to authenticated
  using (public.is_household_member(household_id));
create policy integration_connections_insert on public.integration_connections for insert to authenticated
  with check (public.is_household_owner(household_id));
create policy integration_connections_update on public.integration_connections for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy integration_connections_delete on public.integration_connections for delete to authenticated
  using (public.is_household_owner(household_id));
-- The ciphertext column is never readable by clients.
revoke select on public.integration_connections from anon, authenticated;
grant select (id, household_id, provider, status, config, last_sync_at, last_error, connected_by, created_at, updated_at)
  on public.integration_connections to authenticated;

-- Server-side secret read (still member-checked; returns ciphertext, decrypted only with the server key).
create or replace function public.integration_secret(p_household uuid, p_provider text)
returns text language sql stable security definer set search_path = '' as $$
  select c.secret_ciphertext from public.integration_connections c
  where c.household_id = p_household and c.provider = p_provider and public.is_household_member(p_household)
$$;
revoke execute on function public.integration_secret(uuid, text) from public, anon;
grant execute on function public.integration_secret(uuid, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['smart_home_devices', 'home_automations', 'integration_sync_log'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t);
  end loop;
end $$;

-- Command log is append-only for members.
create policy device_command_log_select on public.device_command_log for select to authenticated
  using (public.is_household_member(household_id));
create policy device_command_log_insert on public.device_command_log for insert to authenticated
  with check (public.is_household_member(household_id) and requested_by = auth.uid());
revoke update, delete on public.device_command_log from anon, authenticated;

alter publication supabase_realtime add table public.smart_home_devices;

-- Offline devices become suggestions (kind 'device'), via the existing engine.
create or replace function public.generate_device_suggestions(p_household uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r record; v_seen text[] := '{}';
begin
  for r in select id, name from public.smart_home_devices
           where household_id = p_household and pinned and not online loop
    perform public.upsert_suggestion(p_household, 'device', 'device_offline:' || r.id, r.name || ' לא מחובר',
      'המכשיר לא מדווח ל-Home Assistant. כדאי לבדוק חשמל ורשת.', 'normal', '/smart-home', null,
      jsonb_build_array(jsonb_build_object('type', 'device', 'id', r.id)), 1, null);
    v_seen := v_seen || ('device_offline:' || r.id);
  end loop;
  update public.ai_suggestions set status = 'expired'
  where household_id = p_household and status = 'active' and kind = 'device' and not (dedupe_key = any (v_seen));
end $$;
revoke execute on function public.generate_device_suggestions(uuid) from public, anon, authenticated;

create or replace function public.generate_suggestions(p_household uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
  v_today date;
begin
  v_n := public.generate_core_suggestions(p_household);
  select (now() at time zone timezone)::date into v_today from public.households where id = p_household;
  perform public.generate_admin_suggestions(p_household, v_today);
  perform public.generate_device_suggestions(p_household);
  return v_n;
end $$;
