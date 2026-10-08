-- Move Mindful — The warm-up block (Phase 4.5)
-- A workout's warm-up is now a sequence of exercises, built like a circuit
-- (each exercise in turn, for a number of rounds) and pinned first: a group
-- row marked `warmup`. At most one per workout. The overview after the intro
-- and the Begin workout list show it as one "Warm-up" row. (The old warm-up
-- video, workouts.warmup_exercise_id, stays as it is — the player leaves it out.)
-- Run in the Supabase SQL Editor after 022_workout_overview_tip.sql.

-- ── The warm-up flag ──────────────────────────────────
-- On group rows only; false everywhere else.
alter table public.workout_blocks
  add column if not exists warmup boolean not null default false;

-- ── save_workout_sequence: now saves a group's `warmup` ─
-- Same signature and behavior as in 021, plus `warmup` on group rows.
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
      insert into workout_blocks (workout_id, position, kind, rounds, rest_between_exercises, rest_between_rounds, warmup, tips)
      values (p_workout_id, pos, 'group', (b->>'rounds')::int,
              (b->>'restBetweenExercises')::int, (b->>'restBetweenRounds')::int,
              coalesce((b->>'warmup')::boolean, false),
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
