-- Move Mindful — The workout overview's audio tip (Phase 4.5)
-- After the intro, the player shows the workout overview: the exercise list
-- over each exercise's loop in turn, while the instructor talks it through.
-- The section lasts as long as this tip (plus a few seconds), and is skipped
-- when a workout has none. Recorded in the builder's Audio tips view, like
-- every other tip ("rundown" in the code).
-- Run in the Supabase SQL Editor after 021_rest_between_sides.sql.

-- One tip, the same shape as the ones on workout_blocks.tips:
--   { "id": "<workout id>/<uuid>.m4a", "seconds": 24.5, "start": …, "end": …, "levels": "…" }
-- Null when the workout has none. The server checks it before saving.
alter table public.workouts add column if not exists rundown_tip jsonb;
