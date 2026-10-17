-- =============================================================================
-- Tenant-isolation & integrity tests (run in the Supabase SQL Editor, or psql
-- as `postgres`). Everything runs inside a transaction that is ROLLED BACK —
-- no data is left behind. Success prints: "ALL RLS TESTS PASSED".
--
-- Simulates two real users (A, B) in two households by switching to the
-- `authenticated` role with forged JWT claims, exactly as PostgREST does.
-- =============================================================================
begin;

create or replace function pg_temp.act_as(p_uid uuid, p_email text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'email', p_email)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  ha uuid; hb uuid;
  list_a uuid; list_b uuid;
  item_b uuid; inv_a uuid; inv_b uuid;
  tok text;
  n int;
  q numeric;
  failed boolean;
begin
  insert into auth.users (id, instance_id, email, aud, role, raw_user_meta_data)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'a@rls.test', 'authenticated', 'authenticated', '{"display_name":"A"}'),
    (b, '00000000-0000-0000-0000-000000000000', 'b@rls.test', 'authenticated', 'authenticated', '{"display_name":"B"}'),
    (c, '00000000-0000-0000-0000-000000000000', 'c@rls.test', 'authenticated', 'authenticated', '{"display_name":"C"}');

  -- ---- Setup: each user creates a household with data ------------------------
  perform pg_temp.act_as(b, 'b@rls.test');
  hb := public.create_household('Home B');
  select id into list_b from public.shopping_lists where household_id = hb and is_default;
  insert into public.shopping_list_items (household_id, list_id, name) values (hb, list_b, 'secret milk')
    returning id into item_b;
  insert into public.inventory_items (household_id, name) values (hb, 'B rice') returning id into inv_b;
  perform public.inventory_apply_movement(inv_b, 'initial', 5);

  perform pg_temp.act_as(a, 'a@rls.test');
  ha := public.create_household('Home A');
  select id into list_a from public.shopping_lists where household_id = ha and is_default;
  insert into public.inventory_items (household_id, name) values (ha, 'A pasta') returning id into inv_a;

  -- ---- 1. Reads are isolated ----------------------------------------------------
  select count(*) into n from public.households where id = hb;
  assert n = 0, 'A can read household B';
  select count(*) into n from public.shopping_list_items where household_id = hb;
  assert n = 0, 'A can read B grocery items';
  select count(*) into n from public.inventory_items where household_id = hb;
  assert n = 0, 'A can read B inventory';
  select count(*) into n from public.inventory_movements where household_id = hb;
  assert n = 0, 'A can read B movements';
  select count(*) into n from public.activity_events where household_id = hb;
  assert n = 0, 'A can read B activity';
  select count(*) into n from public.profiles where id = b;
  assert n = 0, 'A can read B profile';
  select count(*) into n from public.household_memberships where household_id = hb;
  assert n = 0, 'A can read B memberships';

  -- ---- 2. Writes into another household are rejected -----------------------------
  failed := false;
  begin
    insert into public.shopping_list_items (household_id, list_id, name) values (hb, list_b, 'injected');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A inserted into B grocery list';

  -- Tenant integrity: A's own household_id but B's list → composite FK must fail
  failed := false;
  begin
    insert into public.shopping_list_items (household_id, list_id, name) values (ha, list_b, 'cross-link');
  exception when foreign_key_violation or insufficient_privilege then failed := true;
  end;
  assert failed, 'A linked an item to B''s list';

  update public.shopping_list_items set name = 'hacked' where id = item_b;
  get diagnostics n = row_count;
  assert n = 0, 'A updated B grocery item';

  delete from public.shopping_list_items where id = item_b;
  get diagnostics n = row_count;
  assert n = 0, 'A deleted B grocery item';

  failed := false;
  begin
    perform public.inventory_apply_movement(inv_b, 'consume', 1);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A moved stock of B inventory via RPC';

  failed := false;
  begin
    perform public.create_household_invitation(hb, null);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A created an invitation for household B';

  -- ---- 3. Storage paths are household-scoped --------------------------------------
  failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('household-media', hb::text || '/grocery/evil.webp');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A uploaded into B storage folder';

  -- ---- 4. Quantity can only change through movements ------------------------------
  failed := false;
  begin
    update public.inventory_items set quantity = 999 where id = inv_a;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'Direct quantity update was allowed';

  failed := false;
  begin
    insert into public.inventory_movements (household_id, item_id, kind, quantity_delta, quantity_after)
    values (ha, inv_a, 'add', 100, 100);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'Direct movement insert was allowed';

  -- ---- 5. Movement idempotency & arithmetic ---------------------------------------
  perform public.inventory_apply_movement(inv_a, 'add', 3, null, null, 'receipt-123:line-1', 'receipt');
  perform public.inventory_apply_movement(inv_a, 'add', 3, null, null, 'receipt-123:line-1', 'receipt');
  select quantity into q from public.inventory_items where id = inv_a;
  assert q = 3, format('Duplicate receipt line double-counted stock (q=%s)', q);

  perform public.inventory_apply_movement(inv_a, 'consume', 10);
  select quantity into q from public.inventory_items where id = inv_a;
  assert q = 0, 'Consumption went below zero';
  select count(*) into n from public.inventory_items where id = inv_a and stock_confidence = 'estimated';
  assert n = 1, 'Over-consumption did not mark stock as estimated';

  perform public.inventory_apply_movement(inv_a, 'correct', 2);
  select quantity into q from public.inventory_items where id = inv_a;
  assert q = 2, 'Correction did not set exact quantity';

  -- ---- 6. Invitation flow ----------------------------------------------------------
  select token into tok from public.create_household_invitation(ha, 'c@rls.test');

  perform pg_temp.act_as(b, 'b@rls.test');
  failed := false;
  begin
    perform public.accept_household_invitation(tok);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'Email-bound invitation accepted by the wrong user';

  perform pg_temp.act_as(c, 'c@rls.test');
  assert public.accept_household_invitation(tok) = ha, 'Invitation acceptance failed';
  select count(*) into n from public.inventory_items where household_id = ha;
  assert n = 1, 'New member cannot see household data';
  select count(*) into n from public.inventory_items where household_id = hb;
  assert n = 0, 'New member of A can see B';

  -- C is a member, not owner: cannot invite or rename
  failed := false;
  begin
    perform public.create_household_invitation(ha, null);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'Non-owner created an invitation';

  update public.households set name = 'renamed' where id = ha;
  get diagnostics n = row_count;
  assert n = 0, 'Non-owner renamed household';

  -- Token is single-use
  perform pg_temp.as_admin();
  insert into auth.users (id, instance_id, email, aud, role)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'd@rls.test', 'authenticated', 'authenticated');
  perform pg_temp.act_as((select id from auth.users where email = 'd@rls.test'), 'c@rls.test');
  failed := false;
  begin
    perform public.accept_household_invitation(tok);
  exception when others then failed := true;
  end;
  assert failed, 'Invitation token was reusable';

  -- ---- 7. Anonymous users see nothing ----------------------------------------------
  perform pg_temp.as_admin();
  execute 'set local role anon';
  select count(*) into n from public.households;
  assert n = 0, 'anon can read households';
  select count(*) into n from public.shopping_list_items;
  assert n = 0, 'anon can read grocery items';

  perform pg_temp.as_admin();
  raise notice 'ALL RLS TESTS PASSED';
end $$;

rollback;
