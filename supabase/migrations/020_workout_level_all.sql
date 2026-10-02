-- Move Mindful — "All levels" workouts (Phase 4.5)
-- A fourth workout level, for workouts that suit anyone: 'all_levels', shown
-- as "All levels" (LEVELS in apps/web/src/lib/workouts/shared.ts).
-- Run in the Supabase SQL Editor after 019_workout_audio_tips.sql. Safe to
-- run more than once.

alter table public.workouts drop constraint if exists workouts_level_check;
alter table public.workouts add constraint workouts_level_check
  check (level in ('all_levels', 'beginner', 'intermediate', 'advanced'));
