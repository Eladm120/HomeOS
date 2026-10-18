-- =============================================================================
-- Phase 3 tests: suggestion engine (dedupe, dismissal, expiry), private
-- conversations and notifications, receipt duplicate detection and idempotent
-- confirmation. Runs in a rolled-back transaction.
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
  x uuid := gen_random_uuid();
  ha uuid; hx uuid;
  inv uuid; milk uuid;
  list_a uuid; shop uuid;
  conv uuid;
  imp uuid; line uuid;
  tok text;
  n int;
  q numeric;
  failed boolean;
begin
  insert into auth.users (id, instance_id, email, aud, role) values
    (a, '00000000-0000-0000-0000-000000000000', 'a@p3.test', 'authenticated', 'authenticated'),
    (b, '00000000-0000-0000-0000-000000000000', 'b@p3.test', 'authenticated', 'authenticated'),
    (x, '00000000-0000-0000-0000-000000000000', 'x@p3.test', 'authenticated', 'authenticated');

  perform pg_temp.act_as(x, 'x@p3.test');
  hx := public.create_household('Other');

  perform pg_temp.act_as(a, 'a@p3.test');
  ha := public.create_household('Home');
  select token into tok from public.create_household_invitation(ha, null);
  perform pg_temp.act_as(b, 'b@p3.test');
  perform public.accept_household_invitation(tok);

  perform pg_temp.act_as(a, 'a@p3.test');
  insert into public.inventory_items (household_id, name, min_threshold) values (ha, 'אורז', 2) returning id into inv;
  perform public.inventory_apply_movement(inv, 'initial', 1);
  insert into public.inventory_items (household_id, name) values (ha, 'חלב') returning id into milk;
  perform public.inventory_apply_movement(milk, 'initial', 2);

  -- 1. Suggestions: generated once, deduped, dismissals respected, stale ones expire
  n := public.generate_suggestions(ha);
  n := public.generate_suggestions(ha);
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'low_stock';
  assert n = 1, format('expected 1 low-stock suggestion, got %s', n);

  update public.ai_suggestions set status = 'dismissed', dismissed_at = now(), snooze_until = now() + interval '3 days'
  where household_id = ha and kind = 'low_stock';
  perform public.generate_suggestions(ha);
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'low_stock' and status = 'active';
  assert n = 0, 'dismissed suggestion came back during snooze';

  update public.ai_suggestions set status = 'active' where household_id = ha and kind = 'low_stock';
  perform public.inventory_apply_movement(inv, 'add', 5);
  perform public.generate_suggestions(ha);
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'low_stock' and status = 'active';
  assert n = 0, 'restocked item still suggested';

  failed := false;
  begin
    perform public.generate_suggestions(hx);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'member generated suggestions for another household';

  failed := false;
  begin
    insert into public.ai_suggestions (household_id, kind, title, dedupe_key) values (ha, 'reminder', 'x', 'x');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'client inserted a suggestion directly';

  -- 2. Notifications are per member
  perform public.inventory_apply_movement(inv, 'consume', 100);
  perform public.generate_suggestions(ha);
  perform public.notify_from_suggestions(ha);
  perform public.notify_from_suggestions(ha);
  select count(*) into n from public.notifications where user_id = a;
  assert n = 1, format('expected one deduped notification for A, got %s', n);
  perform pg_temp.act_as(b, 'b@p3.test');
  select count(*) into n from public.notifications where user_id = a;
  assert n = 0, 'B can read A notifications';

  -- 3. Conversations are private even inside the household
  perform pg_temp.act_as(a, 'a@p3.test');
  insert into public.ai_conversations (household_id) values (ha) returning id into conv;
  insert into public.ai_messages (household_id, conversation_id, role, content) values (ha, conv, 'user', 'שלום');
  perform pg_temp.act_as(b, 'b@p3.test');
  select count(*) into n from public.ai_messages where conversation_id = conv;
  assert n = 0, 'B can read A conversation';
  failed := false;
  begin
    insert into public.ai_messages (household_id, conversation_id, role, content) values (ha, conv, 'assistant', 'injected');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'B wrote into A conversation';

  -- 4. Receipts: duplicate file rejected; confirmation idempotent and RPC-only
  perform pg_temp.act_as(a, 'a@p3.test');
  select id into list_a from public.shopping_lists where household_id = ha and is_default;
  insert into public.shopping_list_items (household_id, list_id, name, inventory_item_id) values (ha, list_a, 'חלב', milk) returning id into shop;
  insert into public.receipt_imports (household_id, file_path, file_hash, mime_type, store)
  values (ha, ha::text || '/receipts/r1.webp', repeat('a', 64), 'image/webp', 'שופרסל') returning id into imp;
  insert into public.receipt_import_lines (household_id, import_id, raw_name, quantity, inventory_item_id, shopping_item_id, decision)
  values (ha, imp, 'חלב 3%', 2, milk, shop, 'stock') returning id into line;
  insert into public.receipt_import_lines (household_id, import_id, raw_name, quantity, decision) values (ha, imp, 'שקית', 1, 'ignore');

  failed := false;
  begin
    insert into public.receipt_imports (household_id, file_path, file_hash, mime_type)
    values (ha, ha::text || '/receipts/r2.webp', repeat('a', 64), 'image/webp');
  exception when unique_violation then failed := true;
  end;
  assert failed, 'duplicate receipt file accepted';

  failed := false;
  begin
    update public.receipt_imports set status = 'confirmed' where id = imp;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'receipt confirmed without the RPC';

  n := public.confirm_receipt(imp);
  assert n = 1, format('expected 1 stocked line, got %s', n);
  n := public.confirm_receipt(imp);
  assert n = 0, 'second confirmation applied again';
  select quantity into q from public.inventory_items where id = milk;
  assert q = 4, format('milk should be 4 after one receipt, got %s', q);
  select count(*) into n from public.shopping_list_items where id = shop and status = 'purchased';
  assert n = 1, 'matched grocery item not marked purchased';

  perform pg_temp.act_as(x, 'x@p3.test');
  failed := false;
  begin
    perform public.confirm_receipt(imp);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'outsider confirmed a receipt';
  select count(*) into n from public.receipt_imports where id = imp;
  assert n = 0, 'outsider can read receipts';

  raise notice 'PHASE 3 TESTS PASSED';
end $$;

rollback;
