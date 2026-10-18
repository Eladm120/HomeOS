-- =============================================================================
-- HomeOS — Phase 3: household intelligence
-- AI assistant conversations (structured, auditable tool executions), proactive
-- suggestions with dedupe + cooldown, per-user notifications, preferences,
-- receipt imports with duplicate detection, cached daily briefs and AI usage
-- metering.
--
-- Principles:
-- * The chat transcript is never the source of truth. Facts live in their own
--   tables; the assistant reads them through typed, household-scoped tools.
-- * The assistant cannot mutate anything by itself: mutating tools only create
--   proposals (ai_messages.actions), which a member confirms in the UI and which
--   then run through the regular, validated server actions.
-- * Suggestions are generated deterministically from data (generate_suggestions),
--   deduplicated by (household, dedupe_key), and respect dismissals/cooldowns.
-- =============================================================================

create type public.ai_role as enum ('user', 'assistant');
create type public.suggestion_status as enum ('active', 'dismissed', 'done', 'expired');
create type public.receipt_status as enum ('extracted', 'confirmed', 'discarded', 'failed');

-- ---------------------------------------------------------------------------
-- Assistant
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text check (char_length(title) <= 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, household_id)
);
create index ai_conversations_user_idx on public.ai_conversations (household_id, user_id, updated_at desc);
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  conversation_id uuid not null,
  role            public.ai_role not null,
  content         text not null default '' check (char_length(content) <= 20000),
  -- proposals the user can confirm: [{id, type, payload, status}]
  actions         jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  -- references shown under the answer: [{label, href}]
  links           jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  image_path      text,
  model           text,
  input_tokens    int,
  output_tokens   int,
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, household_id) references public.ai_conversations (id, household_id) on delete cascade
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table public.ai_tool_executions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  conversation_id uuid,
  user_id         uuid default auth.uid() references auth.users (id) on delete set null,
  tool_name       text not null check (char_length(tool_name) <= 80),
  input           jsonb not null default '{}'::jsonb,
  ok              boolean not null,
  error           text check (char_length(error) <= 500),
  duration_ms     int,
  created_at      timestamptz not null default now()
);
create index ai_tool_executions_household_idx on public.ai_tool_executions (household_id, created_at desc);

-- Every model call, for cost visibility and future per-household metering.
create table public.ai_usage_events (
  id            bigint generated always as identity primary key,
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid default auth.uid() references auth.users (id) on delete set null,
  feature       text not null check (feature in ('assistant', 'receipt', 'recipe', 'brief', 'bill', 'plant', 'barcode', 'document')),
  model         text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  created_at    timestamptz not null default now()
);
create index ai_usage_events_household_idx on public.ai_usage_events (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Preferences (household-wide when user_id is null, else per member)
-- ---------------------------------------------------------------------------
create table public.household_preferences (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete cascade,
  key          text not null check (key ~ '^[a-z0-9_.]{1,80}$'),
  value        jsonb not null,
  updated_at   timestamptz not null default now()
);
create unique index household_preferences_uq
  on public.household_preferences (household_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create trigger household_preferences_updated_at before update on public.household_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Proactive suggestions
-- ---------------------------------------------------------------------------
create table public.ai_suggestions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  kind          text not null check (kind in (
                  'low_stock', 'expiring', 'overdue_chore', 'chore_due', 'warranty', 'bill_due', 'bill_unusual',
                  'repair_followup', 'recipe', 'meal_plan', 'device', 'plant_water', 'document_expiry', 'reminder')),
  title         text not null check (char_length(title) <= 200),
  body          text check (char_length(body) <= 2000),
  source_refs   jsonb not null default '[]'::jsonb,
  confidence    numeric(3, 2) check (confidence between 0 and 1),
  priority      public.item_priority not null default 'normal',
  action        jsonb,
  href          text check (href ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  dedupe_key    text not null check (char_length(dedupe_key) <= 200),
  status        public.suggestion_status not null default 'active',
  created_at    timestamptz not null default now(),
  refreshed_at  timestamptz not null default now(),
  expires_at    timestamptz,
  dismissed_at  timestamptz,
  dismissed_by  uuid references auth.users (id) on delete set null,
  -- a dismissed suggestion with the same key stays quiet until this time
  snooze_until  timestamptz,
  acted_at      timestamptz,
  unique (household_id, dedupe_key)
);
create index ai_suggestions_active_idx on public.ai_suggestions (household_id, status, priority);

-- ---------------------------------------------------------------------------
-- Notifications (per member)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  category      text not null check (char_length(category) <= 40),
  title         text not null check (char_length(title) <= 200),
  body          text check (char_length(body) <= 1000),
  href          text check (href ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  suggestion_id uuid references public.ai_suggestions (id) on delete cascade,
  dedupe_key    text,
  important     boolean not null default false,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  foreign key (household_id, user_id) references public.household_memberships (household_id, user_id) on delete cascade
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);
create unique index notifications_dedupe_uq on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------
create table public.receipt_imports (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  file_path    text not null check (split_part(file_path, '/', 1) = household_id::text),
  file_hash    text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  mime_type    text not null,
  store        text check (char_length(store) <= 120),
  purchased_on date,
  total        numeric(12, 2),
  currency     text not null default 'ILS',
  status       public.receipt_status not null default 'extracted',
  notice       text check (char_length(notice) <= 500),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  unique (id, household_id),
  -- the same photo/file can only be imported once per household
  unique (household_id, file_hash)
);
create index receipt_imports_household_idx on public.receipt_imports (household_id, created_at desc);

create table public.receipt_import_lines (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  import_id         uuid not null,
  position          int not null default 0,
  raw_name          text not null check (char_length(raw_name) <= 200),
  quantity          numeric(12, 3) check (quantity > 0),
  unit              text check (char_length(unit) <= 20),
  unit_price        numeric(12, 2),
  total_price       numeric(12, 2),
  inventory_item_id uuid,
  shopping_item_id  uuid,
  match_confidence  numeric(3, 2),
  decision          text not null default 'review' check (decision in ('review', 'stock', 'new', 'ignore')),
  foreign key (import_id, household_id) references public.receipt_imports (id, household_id) on delete cascade,
  foreign key (inventory_item_id, household_id) references public.inventory_items (id, household_id) on delete set null (inventory_item_id)
);
create index receipt_import_lines_import_idx on public.receipt_import_lines (import_id, position);

-- ---------------------------------------------------------------------------
-- Daily brief cache (one written brief per household per day)
-- ---------------------------------------------------------------------------
create table public.daily_briefs (
  household_id uuid not null references public.households (id) on delete cascade,
  brief_date   date not null,
  content      jsonb not null,
  model        text,
  created_at   timestamptz not null default now(),
  primary key (household_id, brief_date)
);

-- ---------------------------------------------------------------------------
-- Suggestion engine (deterministic; runs per household from the dashboard and
-- daily from pg_cron when it is available)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_suggestion(
  p_household uuid, p_kind text, p_key text, p_title text, p_body text, p_priority public.item_priority,
  p_href text, p_action jsonb, p_refs jsonb, p_confidence numeric, p_expires timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ai_suggestions (household_id, kind, dedupe_key, title, body, priority, href, action, source_refs, confidence, expires_at)
  values (p_household, p_kind, p_key, p_title, p_body, p_priority, p_href, p_action, coalesce(p_refs, '[]'::jsonb), p_confidence, p_expires)
  on conflict (household_id, dedupe_key) do update set
    title = excluded.title,
    body = excluded.body,
    priority = excluded.priority,
    href = excluded.href,
    action = excluded.action,
    source_refs = excluded.source_refs,
    confidence = excluded.confidence,
    expires_at = excluded.expires_at,
    refreshed_at = now(),
    -- a dismissed/finished suggestion comes back only after its snooze ends
    status = case
      when public.ai_suggestions.status in ('dismissed', 'done')
           and coalesce(public.ai_suggestions.snooze_until, 'infinity'::timestamptz) > now()
        then public.ai_suggestions.status
      else 'active'::public.suggestion_status
    end;
end $$;
revoke execute on function public.upsert_suggestion(uuid, text, text, text, text, public.item_priority, text, jsonb, jsonb, numeric, timestamptz) from public, anon, authenticated;

create or replace function public.generate_suggestions(p_household uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_today date;
  v_tz text;
  r record;
  v_seen text[] := '{}';
  v_count int := 0;
begin
  -- Members may refresh their own household; the scheduler runs without a user.
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  select timezone into v_tz from public.households where id = p_household;
  if v_tz is null then return 0; end if;
  v_today := (now() at time zone v_tz)::date;

  -- Low or empty stock that is not already on the list
  for r in
    select i.id, i.name, i.quantity, i.unit, i.min_threshold, i.stock_confidence
    from public.inventory_items i
    where i.household_id = p_household and i.archived_at is null
      and (i.quantity <= 0 or (i.min_threshold is not null and i.quantity < i.min_threshold))
      and not exists (
        select 1 from public.shopping_list_items s
        where s.inventory_item_id = i.id and s.status = 'pending' and s.deleted_at is null and s.cleared_at is null)
  loop
    perform public.upsert_suggestion(p_household, 'low_stock', 'low_stock:' || r.id,
      case when r.quantity <= 0 then r.name || ' נגמר' else r.name || ' עומד להיגמר' end,
      case when r.stock_confidence = 'estimated' then 'הכמות במלאי משוערת. אפשר להוסיף לרשימה או לעדכן כמות.' else 'להוסיף לרשימת הקניות?' end,
      case when r.quantity <= 0 then 'high'::public.item_priority else 'normal'::public.item_priority end,
      '/inventory/' || r.id, jsonb_build_object('type', 'add_inventory_to_list', 'inventory_item_id', r.id),
      jsonb_build_array(jsonb_build_object('type', 'inventory_item', 'id', r.id)),
      case when r.stock_confidence = 'estimated' then 0.6 else 0.95 end, null);
    v_seen := v_seen || ('low_stock:' || r.id);
    v_count := v_count + 1;
  end loop;

  -- Expiring within 3 days (or expired)
  for r in
    select i.id, i.name, i.expires_on from public.inventory_items i
    where i.household_id = p_household and i.archived_at is null and i.quantity > 0
      and i.expires_on is not null and i.expires_on <= v_today + 3
  loop
    perform public.upsert_suggestion(p_household, 'expiring', 'expiring:' || r.id || ':' || r.expires_on,
      case when r.expires_on < v_today then 'פג התוקף של ' || r.name
           when r.expires_on = v_today then 'התוקף של ' || r.name || ' מסתיים היום'
           else 'התוקף של ' || r.name || ' מסתיים בעוד ' || (r.expires_on - v_today) || ' ימים' end,
      'אפשר לבדוק אם יש מתכון שמשתמש בו.',
      case when r.expires_on <= v_today then 'high'::public.item_priority else 'normal'::public.item_priority end,
      '/inventory/' || r.id, null, jsonb_build_array(jsonb_build_object('type', 'inventory_item', 'id', r.id)), 1, (r.expires_on + 2)::timestamptz);
    v_seen := v_seen || ('expiring:' || r.id || ':' || r.expires_on);
    v_count := v_count + 1;
  end loop;

  -- Chores: overdue, or due today
  for r in
    select c.id, c.title, c.next_due_on, c.assignee_id from public.chores c
    where c.household_id = p_household and c.status = 'active' and c.next_due_on <= v_today
  loop
    perform public.upsert_suggestion(p_household,
      case when r.next_due_on < v_today then 'overdue_chore' else 'chore_due' end,
      'chore:' || r.id || ':' || r.next_due_on,
      case when r.next_due_on < v_today then r.title || ' באיחור' else r.title || ' להיום' end,
      null,
      case when r.next_due_on < v_today then 'high'::public.item_priority else 'normal'::public.item_priority end,
      '/chores/' || r.id, jsonb_build_object('type', 'complete_chore', 'chore_id', r.id),
      jsonb_build_array(jsonb_build_object('type', 'chore', 'id', r.id, 'assignee', r.assignee_id)), 1, null);
    v_seen := v_seen || ('chore:' || r.id || ':' || r.next_due_on);
    v_count := v_count + 1;
  end loop;

  -- Repairs waiting on someone for more than a week
  for r in
    select p.id, p.title, p.updated_at from public.home_projects p
    where p.household_id = p_household and p.kind = 'repair' and p.status = 'waiting'
      and p.updated_at < now() - interval '7 days'
  loop
    perform public.upsert_suggestion(p_household, 'repair_followup', 'repair_followup:' || r.id,
      'לבדוק מה קורה עם: ' || r.title,
      'התיקון ממתין לגורם חיצוני כבר יותר משבוע.',
      'normal', '/projects/' || r.id, null, jsonb_build_array(jsonb_build_object('type', 'project', 'id', r.id)), 1, null);
    v_seen := v_seen || ('repair_followup:' || r.id);
    v_count := v_count + 1;
  end loop;

  -- Anything active that is no longer true expires (e.g. item restocked, chore done)
  update public.ai_suggestions set status = 'expired'
  where household_id = p_household and status = 'active'
    and kind in ('low_stock', 'expiring', 'overdue_chore', 'chore_due', 'repair_followup')
    and not (dedupe_key = any (v_seen));
  update public.ai_suggestions set status = 'expired'
  where household_id = p_household and status = 'active' and expires_at is not null and expires_at < now();

  return v_count;
end $$;

-- Turn high-priority suggestions into notifications for members who opted in
-- (preference key 'notify.<kind>' = false mutes a category). Deduped per user.
create or replace function public.notify_from_suggestions(p_household uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  if auth.uid() is not null and not public.is_household_member(p_household) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  insert into public.notifications (household_id, user_id, category, title, body, href, suggestion_id, dedupe_key, important)
  select s.household_id, m.user_id, s.kind, s.title, s.body, s.href, s.id, s.dedupe_key, s.priority = 'high'
  from public.ai_suggestions s
  join public.household_memberships m on m.household_id = s.household_id
  where s.household_id = p_household and s.status = 'active'
    and (s.priority = 'high' or s.kind in ('chore_due', 'warranty', 'bill_due', 'bill_unusual', 'document_expiry'))
    -- chores notify only their assignee (or everyone when shared)
    and (s.kind not in ('chore_due', 'overdue_chore')
         or (s.source_refs -> 0 ->> 'assignee') is null
         or (s.source_refs -> 0 ->> 'assignee')::uuid = m.user_id)
    and coalesce((
      select (p.value)::text::boolean from public.household_preferences p
      where p.household_id = s.household_id and p.user_id = m.user_id and p.key = 'notify.' || s.kind
    ), true)
    -- frequency preference: 'important' = high priority only; 'daily' = only from the morning job
    and (
      with d as (
        select coalesce((select p.value #>> '{}' from public.household_preferences p
                         where p.household_id = s.household_id and p.user_id = m.user_id and p.key = 'notify.digest'), 'instant') as mode
      )
      select (d.mode <> 'important' or s.priority = 'high') and (d.mode <> 'daily' or auth.uid() is null) from d
    )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.run_daily_jobs()
returns void language plpgsql security definer set search_path = '' as $$
declare h record;
begin
  for h in select id from public.households loop
    perform public.generate_suggestions(h.id);
    perform public.notify_from_suggestions(h.id);
  end loop;
  delete from public.notifications where read_at is not null and read_at < now() - interval '60 days';
end $$;

revoke execute on function public.generate_suggestions(uuid) from public, anon;
revoke execute on function public.notify_from_suggestions(uuid) from public, anon;
revoke execute on function public.run_daily_jobs() from public, anon, authenticated;
grant execute on function public.generate_suggestions(uuid) to authenticated;
grant execute on function public.notify_from_suggestions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Receipt confirmation: one transaction, idempotent per receipt line
-- ---------------------------------------------------------------------------
create or replace function public.confirm_receipt(p_import uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_imp public.receipt_imports;
  l record;
  v_item uuid;
  v_n int := 0;
begin
  select * into v_imp from public.receipt_imports where id = p_import for update;
  if not found or not public.is_household_member(v_imp.household_id) then
    raise exception 'receipt not found' using errcode = '42501';
  end if;
  if v_imp.status = 'confirmed' then
    return 0; -- already applied; never double-count stock
  end if;
  if v_imp.status <> 'extracted' then
    raise exception 'receipt cannot be confirmed' using errcode = '22023';
  end if;

  for l in select * from public.receipt_import_lines where import_id = p_import and decision in ('stock', 'new') order by position loop
    v_item := l.inventory_item_id;
    if l.decision = 'new' or v_item is null then
      insert into public.inventory_items (household_id, name, unit)
      values (v_imp.household_id, left(l.raw_name, 120), coalesce(nullif(l.unit, ''), 'יח׳'))
      returning id into v_item;
      update public.receipt_import_lines set inventory_item_id = v_item where id = l.id;
    end if;
    perform public.inventory_apply_movement(v_item, 'purchase', coalesce(l.quantity, 1),
      left('קבלה' || coalesce(' · ' || v_imp.store, ''), 500), null, 'receipt-line:' || l.id, 'receipt', v_imp.id::text);
    if l.shopping_item_id is not null then
      update public.shopping_list_items set status = 'purchased'
      where id = l.shopping_item_id and household_id = v_imp.household_id and status = 'pending';
    end if;
    v_n := v_n + 1;
  end loop;

  update public.receipt_imports set status = 'confirmed', confirmed_at = now(), confirmed_by = auth.uid() where id = p_import;
  perform public.log_activity(v_imp.household_id, 'receipt', v_imp.id, 'confirmed', jsonb_build_object('name', coalesce(v_imp.store, '')));
  return v_n;
end $$;
revoke execute on function public.confirm_receipt(uuid) from public, anon;
grant execute on function public.confirm_receipt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.ai_conversations      enable row level security;
alter table public.ai_messages           enable row level security;
alter table public.ai_tool_executions    enable row level security;
alter table public.ai_usage_events       enable row level security;
alter table public.household_preferences enable row level security;
alter table public.ai_suggestions        enable row level security;
alter table public.notifications         enable row level security;
alter table public.receipt_imports       enable row level security;
alter table public.receipt_import_lines  enable row level security;
alter table public.daily_briefs          enable row level security;

-- Conversations are private to the member who started them.
create policy ai_conversations_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy ai_messages_own on public.ai_messages for all to authenticated
  using (public.is_household_member(household_id) and exists (
    select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (public.is_household_member(household_id) and exists (
    select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- Audit/metering: members insert their own rows and read the household's.
create policy ai_tool_executions_select on public.ai_tool_executions for select to authenticated
  using (public.is_household_member(household_id));
create policy ai_tool_executions_insert on public.ai_tool_executions for insert to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid());
create policy ai_usage_events_select on public.ai_usage_events for select to authenticated
  using (public.is_household_member(household_id));
create policy ai_usage_events_insert on public.ai_usage_events for insert to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid());

-- Preferences: household-wide rows by any member; personal rows only by their owner.
create policy household_preferences_select on public.household_preferences for select to authenticated
  using (public.is_household_member(household_id) and (user_id is null or user_id = auth.uid()));
create policy household_preferences_write on public.household_preferences for all to authenticated
  using (public.is_household_member(household_id) and (user_id is null or user_id = auth.uid()))
  with check (public.is_household_member(household_id) and (user_id is null or user_id = auth.uid()));

-- Suggestions: members read and dismiss; creation is by generate_suggestions().
create policy ai_suggestions_select on public.ai_suggestions for select to authenticated
  using (public.is_household_member(household_id));
create policy ai_suggestions_update on public.ai_suggestions for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
revoke insert, delete on public.ai_suggestions from anon, authenticated;
revoke update on public.ai_suggestions from anon, authenticated;
grant update (status, dismissed_at, dismissed_by, snooze_until, acted_at) on public.ai_suggestions to authenticated;

-- Notifications: each member sees and marks only their own.
create policy notifications_own_select on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());
revoke insert on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Receipts: household-shared; confirmation only through confirm_receipt().
do $$
declare t text;
begin
  foreach t in array array['receipt_imports', 'receipt_import_lines'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t);
  end loop;
end $$;
revoke update on public.receipt_imports from anon, authenticated;
grant update (store, purchased_on, total, status, notice) on public.receipt_imports to authenticated;
-- 'confirmed' may only be set by confirm_receipt(): block it in direct updates.
create or replace function public.receipt_guard()
returns trigger language plpgsql as $$
begin
  -- inside confirm_receipt() (security definer) current_user is the owner, not 'authenticated'
  if new.status = 'confirmed' and old.status <> 'confirmed' and current_user = 'authenticated' then
    raise exception 'use confirm_receipt()' using errcode = '42501';
  end if;
  if old.status = 'confirmed' and new.status <> 'confirmed' then
    raise exception 'a confirmed receipt cannot be reopened' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger receipt_imports_guard before update on public.receipt_imports
  for each row execute function public.receipt_guard();

create policy daily_briefs_select on public.daily_briefs for select to authenticated
  using (public.is_household_member(household_id));
create policy daily_briefs_upsert on public.daily_briefs for insert to authenticated
  with check (public.is_household_member(household_id));
create policy daily_briefs_update on public.daily_briefs for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.ai_suggestions;

-- ---------------------------------------------------------------------------
-- Daily scheduler (Supabase pg_cron). Skipped where pg_cron is unavailable.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('homeos-daily-jobs', '0 4 * * *', 'select public.run_daily_jobs()');
  end if;
exception when others then
  raise notice 'pg_cron not configured: %', sqlerrm;
end $$;
