-- =============================================================================
-- HomeOS — Phase 2: core household modules
-- Shopping planner (home purchases + alternatives), projects & repairs (one
-- table, two kinds), service providers, attachments, chores (recurring, with
-- completion history), recipes (ingredients, steps, learned ingredient →
-- inventory mappings) and the weekly meal plan.
--
-- Same tenant model as Phase 1: every row has household_id, RLS grants access
-- only through household_memberships, and composite foreign keys keep children
-- inside their parent's household. Member references (owner, assignee) point at
-- household_memberships(household_id, user_id), so only real members of the
-- same household can be assigned.
--
-- Schema decisions:
-- * Repairs are home_projects with kind = 'repair'. They share status, owner,
--   costs, tasks, photos and a timeline; repair-only fields (symptoms,
--   resolution, warranty notes) are nullable columns. One timeline table
--   (project_activities) records notes, troubleshooting, technician visits and
--   quotes, so "what did we try?" lives in one ordered history.
-- * Attachments are one table keyed by (entity_type, entity_id) instead of a
--   table per module; files stay in the household's private storage folder.
-- * Meal plans are dated entries; a "plan" is simply a week of entries.
-- * Planned purchases intentionally have no budget tracking (product scope).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.planned_purchase_status as enum
  ('idea', 'researching', 'considering', 'ready', 'purchased', 'canceled');
create type public.project_kind as enum ('project', 'repair');
create type public.project_status as enum
  ('idea', 'planned', 'in_progress', 'waiting', 'completed', 'canceled');
create type public.project_activity_kind as enum
  ('note', 'troubleshooting', 'technician_visit', 'quote', 'status_change', 'resolution');
create type public.chore_frequency as enum
  ('once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom');
create type public.chore_status as enum ('active', 'paused', 'archived');
create type public.recipe_source as enum
  ('manual', 'website', 'instagram', 'tiktok', 'youtube', 'facebook', 'photo', 'other');
create type public.meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

-- Members are addressable as (household_id, user_id) for composite FKs.
alter table public.household_memberships
  add constraint household_memberships_household_user_key unique (household_id, user_id);

-- ---------------------------------------------------------------------------
-- Generic audit trigger: TG_ARGV[0] = entity type, TG_ARGV[1] = label column.
-- Logs creation, status changes and soft deletion into activity_events.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_label text := v_row ->> tg_argv[1];
begin
  if tg_op = 'INSERT' then
    perform public.log_activity((v_row ->> 'household_id')::uuid, tg_argv[0], (v_row ->> 'id')::uuid, 'created',
      jsonb_build_object('name', v_label));
  elsif tg_op = 'DELETE' then
    perform public.log_activity((v_row ->> 'household_id')::uuid, tg_argv[0], (v_row ->> 'id')::uuid, 'deleted',
      jsonb_build_object('name', v_label));
  elsif (v_new ? 'status') and (v_new ->> 'status') is distinct from (v_old ->> 'status') then
    perform public.log_activity((v_row ->> 'household_id')::uuid, tg_argv[0], (v_row ->> 'id')::uuid, 'status_changed',
      jsonb_build_object('name', v_label, 'from', v_old ->> 'status', 'to', v_new ->> 'status'));
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Service providers (technicians, contractors, stores with a contact)
-- ---------------------------------------------------------------------------
create table public.service_providers (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 120),
  trade        text check (char_length(trade) <= 80),
  phone        text check (char_length(phone) <= 40),
  email        text check (char_length(email) <= 200),
  notes        text check (char_length(notes) <= 2000),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, household_id)
);
create trigger service_providers_updated_at before update on public.service_providers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Projects & repairs
-- ---------------------------------------------------------------------------
create table public.home_projects (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  kind             public.project_kind not null default 'project',
  title            text not null check (char_length(title) between 1 and 160),
  description      text check (char_length(description) <= 5000),
  room_id          uuid,
  priority         public.item_priority not null default 'normal',
  status           public.project_status not null default 'idea',
  owner_id         uuid,
  due_on           date,
  estimated_cost   numeric(12, 2) check (estimated_cost >= 0),
  actual_cost      numeric(12, 2) check (actual_cost >= 0),
  currency         text not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),
  provider_id      uuid,
  -- repair-specific
  symptoms         text check (char_length(symptoms) <= 5000),
  first_reported_on date,
  warranty_notes   text check (char_length(warranty_notes) <= 2000),
  resolution       text check (char_length(resolution) <= 5000),
  completed_at     timestamptz,
  cover_path       text,
  notes            text check (char_length(notes) <= 5000),
  created_by       uuid default auth.uid() references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, household_id),
  foreign key (room_id, household_id) references public.rooms (id, household_id) on delete set null (room_id),
  foreign key (provider_id, household_id) references public.service_providers (id, household_id) on delete set null (provider_id),
  foreign key (household_id, owner_id) references public.household_memberships (household_id, user_id) on delete set null (owner_id)
);
create index home_projects_household_idx on public.home_projects (household_id, status);
create trigger home_projects_updated_at before update on public.home_projects
  for each row execute function public.set_updated_at();

create or replace function public.home_projects_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger home_projects_completion before update on public.home_projects
  for each row execute function public.home_projects_completion();

create table public.project_tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  project_id   uuid not null,
  title        text not null check (char_length(title) between 1 and 200),
  done         boolean not null default false,
  done_at      timestamptz,
  assignee_id  uuid,
  due_on       date,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (project_id, household_id) references public.home_projects (id, household_id) on delete cascade,
  foreign key (household_id, assignee_id) references public.household_memberships (household_id, user_id) on delete set null (assignee_id)
);
create index project_tasks_project_idx on public.project_tasks (project_id, sort_order);
create trigger project_tasks_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

create table public.project_activities (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  project_id   uuid not null,
  kind         public.project_activity_kind not null default 'note',
  body         text not null check (char_length(body) between 1 and 5000),
  occurred_on  date not null default (now() at time zone 'Asia/Jerusalem')::date,
  amount       numeric(12, 2) check (amount >= 0),
  provider_id  uuid,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (project_id, household_id) references public.home_projects (id, household_id) on delete cascade,
  foreign key (provider_id, household_id) references public.service_providers (id, household_id) on delete set null (provider_id)
);
create index project_activities_project_idx on public.project_activities (project_id, occurred_on desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Shopping planner (home purchases — not groceries)
-- ---------------------------------------------------------------------------
create table public.planned_purchases (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 160),
  room_id      uuid,
  project_id   uuid,
  store        text check (char_length(store) <= 120),
  url          text check (url ~* '^https?://' and char_length(url) <= 2000),
  price        numeric(12, 2) check (price >= 0),
  currency     text not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),
  quantity     int not null default 1 check (quantity between 1 and 1000),
  priority     public.item_priority not null default 'normal',
  status       public.planned_purchase_status not null default 'idea',
  dimensions   text check (char_length(dimensions) <= 200),
  color        text check (char_length(color) <= 80),
  material     text check (char_length(material) <= 120),
  image_path   text,
  notes        text check (char_length(notes) <= 5000),
  purchased_at timestamptz,
  sort_order   int not null default 0,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, household_id),
  foreign key (room_id, household_id) references public.rooms (id, household_id) on delete set null (room_id),
  foreign key (project_id, household_id) references public.home_projects (id, household_id) on delete set null (project_id)
);
create index planned_purchases_household_idx on public.planned_purchases (household_id, status);
create trigger planned_purchases_updated_at before update on public.planned_purchases
  for each row execute function public.set_updated_at();

create or replace function public.planned_purchases_status_stamp()
returns trigger language plpgsql as $$
begin
  if new.status = 'purchased' and (tg_op = 'INSERT' or old.status is distinct from 'purchased') then
    new.purchased_at := coalesce(new.purchased_at, now());
  elsif new.status <> 'purchased' then
    new.purchased_at := null;
  end if;
  return new;
end $$;
create trigger planned_purchases_status_stamp before insert or update on public.planned_purchases
  for each row execute function public.planned_purchases_status_stamp();

create table public.purchase_alternatives (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  purchase_id  uuid not null,
  name         text not null check (char_length(name) between 1 and 160),
  store        text check (char_length(store) <= 120),
  url          text check (url ~* '^https?://' and char_length(url) <= 2000),
  price        numeric(12, 2) check (price >= 0),
  currency     text not null default 'ILS' check (currency ~ '^[A-Z]{3}$'),
  dimensions   text check (char_length(dimensions) <= 200),
  color        text check (char_length(color) <= 80),
  material     text check (char_length(material) <= 120),
  image_path   text,
  notes        text check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (purchase_id, household_id) references public.planned_purchases (id, household_id) on delete cascade
);
create index purchase_alternatives_purchase_idx on public.purchase_alternatives (purchase_id);
create trigger purchase_alternatives_updated_at before update on public.purchase_alternatives
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Attachments (photos / files for projects, repairs, purchases, …)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  entity_type  text not null check (entity_type in ('project', 'planned_purchase', 'appliance', 'plant', 'utility_bill')),
  entity_id    uuid not null,
  path         text not null check (path ~ '^[0-9a-f-]{36}/[a-z-]+/[0-9A-Za-z_.-]+$'),
  file_name    text check (char_length(file_name) <= 200),
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf')),
  size_bytes   int check (size_bytes between 0 and 26214400),
  caption      text check (char_length(caption) <= 500),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  -- the file must live in this household's folder
  check (split_part(path, '/', 1) = household_id::text)
);
create index attachments_entity_idx on public.attachments (household_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Chores (recurring household tasks)
-- ---------------------------------------------------------------------------
create table public.chores (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 160),
  description       text check (char_length(description) <= 2000),
  room_id           uuid,
  assignee_id       uuid,
  frequency         public.chore_frequency not null default 'weekly',
  interval_days     int check (interval_days between 1 and 3650),
  next_due_on       date not null default (now() at time zone 'Asia/Jerusalem')::date,
  last_completed_at timestamptz,
  priority          public.item_priority not null default 'normal',
  status            public.chore_status not null default 'active',
  remind            boolean not null default true,
  notes             text check (char_length(notes) <= 2000),
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, household_id),
  check (frequency <> 'custom' or interval_days is not null),
  foreign key (room_id, household_id) references public.rooms (id, household_id) on delete set null (room_id),
  foreign key (household_id, assignee_id) references public.household_memberships (household_id, user_id) on delete set null (assignee_id)
);
create index chores_due_idx on public.chores (household_id, next_due_on) where status = 'active';
create trigger chores_updated_at before update on public.chores
  for each row execute function public.set_updated_at();

create table public.chore_completions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  chore_id     uuid not null,
  due_on       date not null,
  completed_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz not null default now(),
  note         text check (char_length(note) <= 500),
  foreign key (chore_id, household_id) references public.chores (id, household_id) on delete cascade,
  -- one completion per occurrence: a double tap or offline replay cannot skip a cycle
  unique (chore_id, due_on)
);
create index chore_completions_chore_idx on public.chore_completions (chore_id, completed_at desc);

/** Next occurrence after `p_from`, stepping by the chore's frequency. */
create or replace function public.chore_next_due(p_freq public.chore_frequency, p_interval int, p_from date)
returns date language sql immutable as $$
  select case p_freq
    when 'daily'     then p_from + 1
    when 'weekly'    then p_from + 7
    when 'biweekly'  then p_from + 14
    when 'monthly'   then (p_from + interval '1 month')::date
    when 'quarterly' then (p_from + interval '3 months')::date
    when 'yearly'    then (p_from + interval '1 year')::date
    when 'custom'    then p_from + greatest(coalesce(p_interval, 1), 1)
    else null
  end
$$;

/**
 * Complete the current occurrence of a chore. Keeps the cadence: the next due
 * date steps forward from the scheduled date until it is in the future, so a
 * chore finished late does not drift and one finished early is not doubled.
 * Idempotent per occurrence (unique chore_id + due_on).
 */
create or replace function public.complete_chore(p_chore uuid, p_note text default null)
returns public.chores
language plpgsql security definer set search_path = '' as $$
declare
  v_chore public.chores;
  v_today date;
  v_next date;
  v_inserted int;
begin
  select * into v_chore from public.chores where id = p_chore for update;
  if not found or not public.is_household_member(v_chore.household_id) then
    raise exception 'chore not found' using errcode = '42501';
  end if;
  if v_chore.status <> 'active' then
    return v_chore;
  end if;

  select (now() at time zone h.timezone)::date into v_today from public.households h where h.id = v_chore.household_id;

  insert into public.chore_completions (household_id, chore_id, due_on, completed_by, note)
  values (v_chore.household_id, v_chore.id, v_chore.next_due_on, auth.uid(), nullif(trim(p_note), ''))
  on conflict (chore_id, due_on) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return v_chore; -- this occurrence was already completed
  end if;

  if v_chore.frequency = 'once' then
    update public.chores set status = 'archived', last_completed_at = now() where id = v_chore.id
    returning * into v_chore;
  else
    v_next := public.chore_next_due(v_chore.frequency, v_chore.interval_days, v_chore.next_due_on);
    while v_next <= v_today loop
      v_next := public.chore_next_due(v_chore.frequency, v_chore.interval_days, v_next);
    end loop;
    update public.chores set next_due_on = v_next, last_completed_at = now() where id = v_chore.id
    returning * into v_chore;
  end if;

  perform public.log_activity(v_chore.household_id, 'chore', v_chore.id, 'completed',
    jsonb_build_object('name', v_chore.title));
  return v_chore;
end $$;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  description     text check (char_length(description) <= 3000),
  image_path      text,
  image_url       text check (image_url ~* '^https://' and char_length(image_url) <= 2000),
  source_url      text check (source_url ~* '^https?://' and char_length(source_url) <= 2000),
  source_platform public.recipe_source not null default 'manual',
  prep_minutes    int check (prep_minutes between 0 and 10000),
  cook_minutes    int check (cook_minutes between 0 and 10000),
  servings        numeric(6, 2) check (servings > 0),
  category        text check (char_length(category) <= 60),
  tags            text[] not null default '{}' check (cardinality(tags) <= 20),
  notes           text check (char_length(notes) <= 5000),
  is_favorite     boolean not null default false,
  rating          smallint check (rating between 1 and 5),
  last_cooked_on  date,
  times_cooked    int not null default 0,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, household_id)
);
create index recipes_household_idx on public.recipes (household_id, lower(title));
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  recipe_id         uuid not null,
  position          int not null default 0,
  name              text not null check (char_length(name) between 1 and 160),
  quantity          numeric(12, 3) check (quantity > 0),
  unit              text check (char_length(unit) <= 30),
  note              text check (char_length(note) <= 300),
  optional          boolean not null default false,
  inventory_item_id uuid,
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade,
  foreign key (inventory_item_id, household_id)
    references public.inventory_items (id, household_id) on delete set null (inventory_item_id)
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

create table public.recipe_steps (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id    uuid not null,
  position     int not null default 0,
  body         text not null check (char_length(body) between 1 and 3000),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, position);

-- Learned "this ingredient is that inventory product" links, reused by every recipe.
create table public.ingredient_product_mappings (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  ingredient_key    text not null check (char_length(ingredient_key) between 1 and 160),
  inventory_item_id uuid not null,
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (household_id, ingredient_key),
  foreign key (inventory_item_id, household_id)
    references public.inventory_items (id, household_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Weekly meal plan
-- ---------------------------------------------------------------------------
create table public.meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date    date not null,
  slot         public.meal_slot not null default 'dinner',
  recipe_id    uuid,
  title        text check (char_length(title) <= 160),
  servings     numeric(6, 2) check (servings > 0),
  notes        text check (char_length(notes) <= 1000),
  sort_order   int not null default 0,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (recipe_id is not null or title is not null),
  foreign key (recipe_id, household_id) references public.recipes (id, household_id) on delete cascade
);
create index meal_plan_entries_date_idx on public.meal_plan_entries (household_id, plan_date);
create trigger meal_plan_entries_updated_at before update on public.meal_plan_entries
  for each row execute function public.set_updated_at();

/** Mark a recipe as cooked today (household timezone). */
create or replace function public.mark_recipe_cooked(p_recipe uuid)
returns public.recipes
language plpgsql security definer set search_path = '' as $$
declare
  v_recipe public.recipes;
begin
  select * into v_recipe from public.recipes where id = p_recipe for update;
  if not found or not public.is_household_member(v_recipe.household_id) then
    raise exception 'recipe not found' using errcode = '42501';
  end if;
  update public.recipes r set
    last_cooked_on = (now() at time zone h.timezone)::date,
    times_cooked = r.times_cooked + 1
  from public.households h
  where r.id = p_recipe and h.id = r.household_id
  returning r.* into v_recipe;
  return v_recipe;
end $$;

-- ---------------------------------------------------------------------------
-- Audit triggers
-- ---------------------------------------------------------------------------
create trigger home_projects_audit after insert or update or delete on public.home_projects
  for each row execute function public.audit_row('project', 'title');
create trigger planned_purchases_audit after insert or update or delete on public.planned_purchases
  for each row execute function public.audit_row('planned_purchase', 'name');
create trigger chores_audit after insert or delete on public.chores
  for each row execute function public.audit_row('chore', 'title');
create trigger recipes_audit after insert or delete on public.recipes
  for each row execute function public.audit_row('recipe', 'title');

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'service_providers', 'home_projects', 'project_tasks', 'project_activities',
    'planned_purchases', 'purchase_alternatives', 'attachments',
    'chores', 'chore_completions',
    'recipes', 'recipe_ingredients', 'recipe_steps', 'ingredient_product_mappings',
    'meal_plan_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.is_household_member(household_id))', t);
  end loop;
end $$;

-- Completion history is written only by complete_chore(); members may read it.
drop policy chore_completions_insert on public.chore_completions;
drop policy chore_completions_update on public.chore_completions;
revoke insert, update on public.chore_completions from anon, authenticated;

-- Bookkeeping columns are server-maintained.
revoke update on public.chores from anon, authenticated;
grant update (title, description, room_id, assignee_id, frequency, interval_days, next_due_on,
  priority, status, remind, notes) on public.chores to authenticated;
revoke update on public.recipes from anon, authenticated;
grant update (title, description, image_path, image_url, source_url, source_platform, prep_minutes,
  cook_minutes, servings, category, tags, notes, is_favorite, rating) on public.recipes to authenticated;

revoke execute on function public.complete_chore(uuid, text) from public, anon;
revoke execute on function public.mark_recipe_cooked(uuid) from public, anon;
grant execute on function public.complete_chore(uuid, text) to authenticated;
grant execute on function public.mark_recipe_cooked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: shared lists that both members watch
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.chores;
alter publication supabase_realtime add table public.home_projects;
alter publication supabase_realtime add table public.planned_purchases;
alter publication supabase_realtime add table public.meal_plan_entries;
