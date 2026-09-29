-- Move Mindful — Exercise intensity (Phase 4.5)
-- How hard an exercise is, 1 (gentle) to 4 (intense), set in the exercise
-- form. It gives "Generate with AI" in the workout builder something to vary
-- a workout's rhythm with. Optional, and exercises only: warm-ups have none.
-- Run in the Supabase SQL Editor after 013_workout_sessions.sql.

alter table public.exercises
  add column intensity smallint check (intensity between 1 and 4);

alter table public.exercises
  add constraint exercises_intensity_exercise_only
    check (kind = 'exercise' or intensity is null);
