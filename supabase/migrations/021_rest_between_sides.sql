-- Move Mindful — Rest between sides (Phase 4.5)
-- An exercise done on each side can have a rest between its right and left
-- sides, every set (a single exercise) or round (in a superset or circuit).
-- Optional: none unless the builder sets one.
-- Run in the Supabase SQL Editor after 020_workout_level_all.sql.

-- ── Rest between a sided exercise's sides ─────────────
-- Seconds, on exercise rows (top-level and a group's). Ignored for an
-- exercise that isn't done on each side. Null or 0: no rest.
alter table public.workout_blocks
  add column if not exists rest_between_sides integer check (rest_between_sides >= 0);

-- ── save_workout_sequence: now saves restBetweenSides ─
-- Same signature and behavior as in 019, plus rest_between_sides on exercise
-- rows, top-level and in groups.
create or replace function public.save_workout_sequence(
  p_workout_id uuid,
  p_warmup_exercise_id uuid,
  p_blocks jsonb
) returns void
language plpgsql
set search_path = public
as $$
declare
  b jsonb;
  m jsonb;
  pos integer := 0;
  child_pos integer;
  group_id uuid;
begin
  delete from workout_blocks where workout_id = p_workout_id;
  update workouts
    set warmup_exercise_id = p_warmup_exercise_id, updated_at = now()
    where id = p_workout_id;

  for b in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    if b->>'kind' = 'exercise' then
      insert into workout_blocks (workout_id, position, kind, exercise_id, sets, rest_between_sets, measure, amount, first_side,
                                  rest_between_sides, tips)
      values (p_workout_id, pos, 'exercise', (b->>'exerciseId')::uuid, (b->>'sets')::int,
              coalesce((b->>'restBetweenSets')::int, 0), b->>'measure', (b->>'amount')::int, b->>'firstSide',
              coalesce((b->>'restBetweenSides')::int, 0),
              case when jsonb_typeof(b->'tips') = 'object' then b->'tips' end);
    elsif b->>'kind' = 'rest' then
      insert into workout_blocks (workout_id, position, kind, rest_seconds, tips)
      values (p_workout_id, pos, 'rest', (b->>'seconds')::int,
              case when jsonb_typeof(b->'tips') = 'object' then b->'tips' end);
    elsif b->>'kind' = 'group' then
      insert into workout_blocks (workout_id, position, kind, rounds, rest_between_exercises, rest_between_rounds, tips)
      values (p_workout_id, pos, 'group', (b->>'rounds')::int,
              (b->>'restBetweenExercises')::int, (b->>'restBetweenRounds')::int,
              case when jsonb_typeof(b->'tips') = 'object' then b->'tips' end)
      returning id into group_id;
      child_pos := 0;
      for m in select * from jsonb_array_elements(coalesce(b->'moves', '[]'::jsonb)) loop
        insert into workout_blocks (workout_id, parent_id, position, kind, exercise_id, measure, amount, first_side,
                                    rest_between_sides, tips)
        values (p_workout_id, group_id, child_pos, 'exercise', (m->>'exerciseId')::uuid,
                m->>'measure', (m->>'amount')::int, m->>'firstSide',
                coalesce((m->>'restBetweenSides')::int, 0),
                case when jsonb_typeof(m->'tips') = 'object' then m->'tips' end);
        child_pos := child_pos + 1;
      end loop;
    else
      raise exception 'Unknown block kind: %', b->>'kind';
    end if;
    pos := pos + 1;
  end loop;
end;
$$;

revoke execute on function public.save_workout_sequence(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_workout_sequence(uuid, uuid, jsonb) to service_role;
