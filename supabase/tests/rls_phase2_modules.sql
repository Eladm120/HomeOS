-- =============================================================================
-- Phase 2 module tests: tenant isolation, cross-household links, member-only
-- assignment, chore cadence and idempotency. Runs in a rolled-back transaction.
-- Success prints: "PHASE 2 TESTS PASSED".
-- =============================================================================
begin;

create or replace function pg_temp.act_as(p_uid uuid, p_email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'email', p_email)::text, true);
  execute 'set local role authenticated';
end $$;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ha uuid; hb uuid;
  room_b uuid;
  proj_a uuid; proj_b uuid;
  chore_a uuid; chore_b uuid;
  recipe_b uuid;
  v_chore public.chores;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  n int;
  failed boolean;
begin
  insert into auth.users (id, instance_id, email, aud, role, raw_user_meta_data) values
    (a, '00000000-0000-0000-0000-000000000000', 'a@p2.test', 'authenticated', 'authenticated', '{"display_name":"A"}'),
    (b, '00000000-0000-0000-0000-000000000000', 'b@p2.test', 'authenticated', 'authenticated', '{"display_name":"B"}');

  perform pg_temp.act_as(b, 'b@p2.test');
  hb := public.create_household('Home B');
  select id into room_b from public.rooms where household_id = hb limit 1;
  insert into public.home_projects (household_id, title, kind, room_id) values (hb, 'B repair', 'repair', room_b) returning id into proj_b;
  insert into public.chores (household_id, title) values (hb, 'B chore') returning id into chore_b;
  insert into public.recipes (household_id, title) values (hb, 'B recipe') returning id into recipe_b;
  insert into public.planned_purchases (household_id, name) values (hb, 'B sofa');

  perform pg_temp.act_as(a, 'a@p2.test');
  ha := public.create_household('Home A');

  -- 1. Reads are isolated
  select count(*) into n from public.home_projects where household_id = hb;
  assert n = 0, 'A can read B projects';
  select count(*) into n from public.chores where household_id = hb;
  assert n = 0, 'A can read B chores';
  select count(*) into n from public.recipes where household_id = hb;
  assert n = 0, 'A can read B recipes';
  select count(*) into n from public.planned_purchases where household_id = hb;
  assert n = 0, 'A can read B planned purchases';

  -- 2. Writes into B are rejected
  failed := false;
  begin
    insert into public.home_projects (household_id, title) values (hb, 'injected');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A inserted a project into B';

  update public.chores set title = 'hacked' where id = chore_b;
  get diagnostics n = row_count;
  assert n = 0, 'A updated a B chore';

  -- 3. Cannot link own rows to B's parents (composite FKs)
  failed := false;
  begin
    insert into public.home_projects (household_id, title, room_id) values (ha, 'mine', room_b);
  exception when foreign_key_violation then failed := true;
  end;
  assert failed, 'A linked a project to a B room';

  failed := false;
  begin
    insert into public.project_tasks (household_id, project_id, title) values (ha, proj_b, 'task');
  exception when foreign_key_violation then failed := true;
  end;
  assert failed, 'A attached a task to a B project';

  failed := false;
  begin
    insert into public.meal_plan_entries (household_id, plan_date, recipe_id) values (ha, v_today, recipe_b);
  exception when foreign_key_violation then failed := true;
  end;
  assert failed, 'A planned a B recipe';

  -- 4. Only members of the same household can be assigned
  failed := false;
  begin
    insert into public.chores (household_id, title, assignee_id) values (ha, 'assign B', b);
  exception when foreign_key_violation then failed := true;
  end;
  assert failed, 'A assigned a chore to a non-member';

  -- 5. Attachments must live in the household's own storage folder
  insert into public.home_projects (household_id, title) values (ha, 'A project') returning id into proj_a;
  failed := false;
  begin
    insert into public.attachments (household_id, entity_type, entity_id, path, mime_type)
    values (ha, 'project', proj_a, hb::text || '/projects/x.webp', 'image/webp');
  exception when check_violation then failed := true;
  end;
  assert failed, 'attachment path outside household folder accepted';

  -- 6. Chores: other household cannot complete; completion history is RPC-only
  failed := false;
  begin
    perform public.complete_chore(chore_b);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A completed a B chore';

  insert into public.chores (household_id, title, frequency, next_due_on)
  values (ha, 'weekly sheets', 'weekly', v_today - 10) returning id into chore_a;

  failed := false;
  begin
    insert into public.chore_completions (household_id, chore_id, due_on) values (ha, chore_a, v_today);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'direct chore completion insert allowed';

  -- Overdue by 10 days, weekly: next due keeps the cadence and lands in the future.
  v_chore := public.complete_chore(chore_a);
  assert v_chore.next_due_on = v_today - 10 + 14, format('cadence wrong: %s', v_chore.next_due_on);
  select count(*) into n from public.chore_completions where chore_id = chore_a;
  assert n = 1, 'completion not recorded';

  -- Monthly from the 31st clamps to the end of the next month.
  assert public.chore_next_due('monthly', null, date '2026-01-31') = date '2026-02-28', 'monthly clamp wrong';
  assert public.chore_next_due('custom', 3, date '2026-01-01') = date '2026-01-04', 'custom interval wrong';

  -- One-off chores archive when done.
  insert into public.chores (household_id, title, frequency) values (ha, 'once', 'once') returning id into chore_a;
  v_chore := public.complete_chore(chore_a);
  assert v_chore.status = 'archived', 'one-off chore not archived';
  v_chore := public.complete_chore(chore_a);
  select count(*) into n from public.chore_completions where chore_id = chore_a;
  assert n = 1, 'archived chore completed twice';

  -- 7. Status stamps and audit
  update public.home_projects set status = 'completed' where id = proj_a;
  select count(*) into n from public.home_projects where id = proj_a and completed_at is not null;
  assert n = 1, 'completed_at not stamped';
  select count(*) into n from public.activity_events where household_id = ha and entity_type = 'project' and action = 'status_changed';
  assert n = 1, 'project status change not audited';

  raise notice 'PHASE 2 TESTS PASSED';
end $$;

rollback;
