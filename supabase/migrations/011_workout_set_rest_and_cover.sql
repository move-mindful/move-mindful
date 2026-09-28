-- Move Mindful — Rest between sets + workout cover images (Phase 4.5)
-- Run in the Supabase SQL Editor after 010_workouts.sql.

-- ── Rest between a single exercise's sets ─────────────
-- Seconds of rest after every set but the last. Only used on top-level
-- exercise blocks (a group's exercises do one set per round).
alter table public.workout_blocks
  add column rest_between_sets integer check (rest_between_sets >= 0);

-- ── Cover image ───────────────────────────────────────
-- Public URL in the `workout-covers` Storage bucket; shown at the top of the
-- member's workout preview.
alter table public.workouts add column cover_image_url text;

-- Public bucket: covers are served via public URLs. Uploads run server-side
-- with the service-role key (which bypasses storage RLS), so no public write
-- policy is added.
insert into storage.buckets (id, name, public)
values ('workout-covers', 'workout-covers', true)
on conflict (id) do nothing;

-- ── save_workout_sequence: now saves restBetweenSets ──
-- Same signature and behavior as in 010, plus rest_between_sets on
-- exercise blocks.
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
      insert into workout_blocks (workout_id, position, kind, exercise_id, sets, rest_between_sets, measure, amount, first_side)
      values (p_workout_id, pos, 'exercise', (b->>'exerciseId')::uuid, (b->>'sets')::int,
              coalesce((b->>'restBetweenSets')::int, 0), b->>'measure', (b->>'amount')::int, b->>'firstSide');
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

revoke execute on function public.save_workout_sequence(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_workout_sequence(uuid, uuid, jsonb) to service_role;
