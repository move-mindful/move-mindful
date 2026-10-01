-- Move Mindful — Instructor audio tips (Phase 4.5)
-- A short recording from the instructor for any set (each side of a sided
-- set) or rest in a workout, recorded in the builder's "Audio tips" view.
-- Members hear it a moment into that set or rest, with the instructor's photo
-- on screen. All optional.
-- Run in the Supabase SQL Editor after 018_intro_outro_cooldown.sql.

-- ── Tips on the sequence ──────────────────────────────
-- Kept on the block rows, since the builder rewrites every row on save:
--   { "sets": { "<slot>": tip, … }, "rests": { "<slot>": tip, … } }
-- where a tip is { "id": "<workout id>/<uuid>.m4a", "seconds": 6.2 }.
-- "sets" is on exercise rows (top-level and a group's), one per set or
-- round and per side when sided ("2", "2:left"). "rests" is on top-level
-- rows, one per rest ("rest" on a rest block, "n" before a single
-- exercise's set n, "r:m" before move m of a group's round r). See TipMap in
-- packages/core/src/workouts.ts. Null when the row has none.
alter table public.workout_blocks add column tips jsonb;

-- ── The recordings ────────────────────────────────────
-- Public bucket, like the covers: files are served by their (unguessable)
-- public URLs, which only reach members the workout is open to. Uploads and
-- clean-up run server-side with the service-role key, so no write policy.
insert into storage.buckets (id, name, public)
values ('workout-tips', 'workout-tips', true)
on conflict (id) do nothing;

-- ── save_workout_sequence: now saves tips ─────────────
-- Same signature and behavior as in 011, plus each row's `tips` (any JSON
-- object; the server has already checked it).
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
      insert into workout_blocks (workout_id, position, kind, exercise_id, sets, rest_between_sets, measure, amount, first_side, tips)
      values (p_workout_id, pos, 'exercise', (b->>'exerciseId')::uuid, (b->>'sets')::int,
              coalesce((b->>'restBetweenSets')::int, 0), b->>'measure', (b->>'amount')::int, b->>'firstSide',
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
        insert into workout_blocks (workout_id, parent_id, position, kind, exercise_id, measure, amount, first_side, tips)
        values (p_workout_id, group_id, child_pos, 'exercise', (m->>'exerciseId')::uuid,
                m->>'measure', (m->>'amount')::int, m->>'firstSide',
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
