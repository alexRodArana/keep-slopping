-- Extend the existing incremental sync whitelist without changing its ownership,
-- permissions, collection merge behavior, or the training app's allowed keys.
begin;

do $migration$
declare
  definition text;
  previous_keys text := 'allowed := array[''planVersion'', ''target'', ''creatineDates'', ''meals'', ''sessions''];';
  next_keys text := 'allowed := array[''planVersion'', ''target'', ''planNotes'', ''creatineDates'', ''meals'', ''sessions''];';
begin
  select pg_get_functiondef('public.patch_goy_app_state(text,uuid,jsonb,jsonb)'::regprocedure)
    into definition;
  if strpos(definition, next_keys) > 0 then
    return;
  end if;
  if cardinality(string_to_array(definition, previous_keys)) <> 2 then
    raise exception 'Unexpected incremental sync definition; no changes applied';
  end if;
  execute replace(definition, previous_keys, next_keys);
end;
$migration$;

commit;
