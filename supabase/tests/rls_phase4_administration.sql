-- =============================================================================
-- Phase 4 tests: document search scope, sensitive documents, plant watering
-- idempotency, bill de-duplication, warranty and unusual-bill suggestions.
-- Runs in a rolled-back transaction.
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
  doc uuid; plant uuid;
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  tok text;
  n int;
  failed boolean;
begin
  insert into auth.users (id, instance_id, email, aud, role) values
    (a, '00000000-0000-0000-0000-000000000000', 'a@p4.test', 'authenticated', 'authenticated'),
    (b, '00000000-0000-0000-0000-000000000000', 'b@p4.test', 'authenticated', 'authenticated'),
    (x, '00000000-0000-0000-0000-000000000000', 'x@p4.test', 'authenticated', 'authenticated');

  perform pg_temp.act_as(x, 'x@p4.test');
  hx := public.create_household('Other');
  insert into public.documents (household_id, title, file_path, mime_type, extracted_text)
  values (hx, 'פוליסת ביטוח של מישהו אחר', hx::text || '/documents/x.pdf', 'application/pdf', 'ביטוח דירה');

  perform pg_temp.act_as(a, 'a@p4.test');
  ha := public.create_household('Home');
  select token into tok from public.create_household_invitation(ha, null);
  perform pg_temp.act_as(b, 'b@p4.test');
  perform public.accept_household_invitation(tok);

  -- 1. Search is scoped to the household even if another id is passed
  perform pg_temp.act_as(a, 'a@p4.test');
  insert into public.documents (household_id, title, file_path, mime_type, extracted_text, sensitive, expires_on)
  values (ha, 'ביטוח דירה', ha::text || '/documents/d.pdf', 'application/pdf', 'הפוליסה בתוקף עד סוף השנה', true, v_today + 20)
  returning id into doc;
  select count(*) into n from public.search_documents(ha, 'ביטוח');
  assert n = 1, format('expected 1 own document, got %s', n);
  select count(*) into n from public.search_documents(hx, 'ביטוח');
  assert n = 0, 'search returned another household''s documents';

  -- 2. Sensitive documents can only be deleted by their uploader
  perform pg_temp.act_as(b, 'b@p4.test');
  delete from public.documents where id = doc;
  get diagnostics n = row_count;
  assert n = 0, 'another member deleted a sensitive document';

  -- 3. Watering is recorded once per day
  perform pg_temp.act_as(a, 'a@p4.test');
  insert into public.plants (household_id, name, watering_interval_days, last_watered_on) values (ha, 'מונסטרה', 7, v_today - 9) returning id into plant;
  perform public.water_plant(plant);
  perform public.water_plant(plant);
  select count(*) into n from public.plant_care_events where plant_id = plant and kind = 'water';
  assert n = 1, 'plant watered twice on the same day';
  perform pg_temp.act_as(x, 'x@p4.test');
  failed := false;
  begin
    perform public.water_plant(plant);
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'outsider watered a plant';

  -- 4. The same bill cannot be entered twice
  perform pg_temp.act_as(a, 'a@p4.test');
  insert into public.utility_bills (household_id, category, period_start, period_end, amount) values (ha, 'electricity', v_today - 150, v_today - 91, 400);
  insert into public.utility_bills (household_id, category, period_start, period_end, amount) values (ha, 'electricity', v_today - 90, v_today - 31, 410);
  failed := false;
  begin
    insert into public.utility_bills (household_id, category, period_start, period_end, amount) values (ha, 'electricity', v_today - 90, v_today - 31, 410);
  exception when unique_violation then failed := true;
  end;
  assert failed, 'duplicate bill accepted';

  -- 5. Suggestions: warranty, unusual bill (per day), document expiry
  insert into public.appliances (household_id, name, warranty_until) values (ha, 'מקרר', v_today + 10);
  insert into public.utility_bills (household_id, category, period_start, period_end, amount, due_on)
  values (ha, 'electricity', v_today - 30, v_today - 1, 700, v_today + 3);
  perform public.generate_suggestions(ha);
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'warranty' and status = 'active';
  assert n = 1, 'warranty suggestion missing';
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'bill_unusual' and status = 'active';
  assert n = 1, 'unusual bill not flagged';
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'bill_due' and status = 'active';
  assert n = 1, 'bill due not suggested';
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'document_expiry' and status = 'active';
  assert n = 1, 'document expiry not suggested';
  select count(*) into n from public.ai_suggestions where household_id = ha and kind = 'plant_water' and status = 'active';
  assert n = 0, 'watered plant still suggested';

  raise notice 'PHASE 4 TESTS PASSED';
end $$;

rollback;
