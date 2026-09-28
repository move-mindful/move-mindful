-- Move Mindful — Workouts (Phase 4.5, step 3)
-- Workouts assembled from the exercise library (009_exercises.sql).
-- Run in the Supabase SQL Editor.

-- ── Workouts ──────────────────────────────────────────
create table public.workouts (
  id                  uuid default gen_random_uuid() primary key,
  title               text not null,
  description         text not null default '',
  level               text check (level in ('beginner', 'intermediate', 'advanced')),
  instructor_id       uuid references public.instructors(id) on delete set null,
  -- Optional warm-up (an exercise of kind 'warmup'), offered before the workout.
  -- Restrict: a warm-up in use can be archived, not deleted.
  warmup_exercise_id  uuid references public.exercises(id) on delete restrict,
  -- Null = draft.
  published_at        timestamptz,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

-- ── Workout blocks ────────────────────────────────────
-- The sequence, top to bottom. A top-level row (parent_id null) is one of:
--   exercise — a single exercise done for `sets` sets
--   rest     — a rest of `rest_seconds`
--   group    — a superset (2 exercises) / circuit (3+): `rounds`, with
--              `rest_between_exercises` after each exercise except a round's
--              last, and `rest_between_rounds` after each round but the final one
-- A group's exercises are child rows (parent_id = the group), kind 'exercise',
-- done once per round (no `sets`).
--
-- measure/amount: 'reps' or 'time' (seconds); per side for a sided exercise,
-- whose `first_side` says which side goes first.
--
-- exercise_id is ON DELETE RESTRICT: an exercise a workout uses can't be
-- deleted (archive it instead).
create table public.workout_blocks (
  id                      uuid default gen_random_uuid() primary key,
  workout_id              uuid not null references public.workouts(id) on delete cascade,
  parent_id               uuid references public.workout_blocks(id) on delete cascade,
  position                integer not null,
  kind                    text not null check (kind in ('exercise', 'rest', 'group')),
  exercise_id             uuid references public.exercises(id) on delete restrict,
  sets                    integer check (sets > 0),
  measure                 text check (measure in ('reps', 'time')),
  amount                  integer check (amount > 0),
  first_side              text check (first_side in ('right', 'left')),
  rest_seconds            integer check (rest_seconds >= 0),
  rounds                  integer check (rounds > 0),
  rest_between_exercises  integer check (rest_between_exercises >= 0),
  rest_between_rounds     integer check (rest_between_rounds >= 0),
  constraint workout_blocks_shape check (
    (kind = 'exercise' and exercise_id is not null and measure is not null and amount is not null
       and (parent_id is not null or sets is not null))
    or (kind = 'rest' and parent_id is null and rest_seconds is not null)
    or (kind = 'group' and parent_id is null and rounds is not null)
  )
);
create index workout_blocks_workout_idx on public.workout_blocks(workout_id, parent_id, position);
create index workout_blocks_exercise_idx on public.workout_blocks(exercise_id);

-- ── Save a whole sequence atomically ──────────────────
-- The builder saves the sequence as one JSON array; this replaces the
-- workout's blocks in a single transaction, so a failed save never leaves a
-- half-written workout. Shape (camelCase, as the builder sends it):
--   { kind: 'exercise', exerciseId, sets, measure, amount, firstSide }
--   { kind: 'rest', seconds }
--   { kind: 'group', rounds, restBetweenExercises, restBetweenRounds,
--     moves: [{ exerciseId, measure, amount, firstSide }] }
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
      insert into workout_blocks (workout_id, position, kind, exercise_id, sets, measure, amount, first_side)
      values (p_workout_id, pos, 'exercise', (b->>'exerciseId')::uuid, (b->>'sets')::int,
              b->>'measure', (b->>'amount')::int, b->>'firstSide');
    elsif b->>'kind' = 'rest' then
      insert into workout_blocks (workout_id, position, kind, rest_seconds)
      values (p_workout_id, pos, 'rest', (b->>'seconds')::int);
    elsif b->>'kind' = 'group' then
      insert into workout_blocks (workout_id, position, kind, rounds, rest_between_exercises, rest_between_rounds)
      values (p_workout_id, pos, 'group', (b->>'rounds')::int,
              (b->>'restBetweenExercises')::int, (b->>'restBetweenRounds')::int)
      returning id into group_id;
      child_pos := 0;
      for m in select * from jsonb_array_elements(coalesce(b->'moves', '[]'::jsonb)) loop
        insert into workout_blocks (workout_id, parent_id, position, kind, exercise_id, measure, amount, first_side)
        values (p_workout_id, group_id, child_pos, 'exercise', (m->>'exerciseId')::uuid,
                m->>'measure', (m->>'amount')::int, m->>'firstSide');
        child_pos := child_pos + 1;
      end loop;
    else
      raise exception 'Unknown block kind: %', b->>'kind';
    end if;
    pos := pos + 1;
  end loop;
end;
$$;

-- Only the server (service role) may call it.
revoke execute on function public.save_workout_sequence(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_workout_sequence(uuid, uuid, jsonb) to service_role;

-- ── Row Level Security ────────────────────────────────
-- Admin reads and writes go through the service-role key. Member read
-- policies come with the player (Phase 4.5 step 4).
alter table public.workouts enable row level security;
alter table public.workout_blocks enable row level security;
