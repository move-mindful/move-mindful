-- Move Mindful — Intro, outro and cool-down videos (Phase 4.5)
-- A workout can open with an intro video and close with an outro, both its
-- own; and offer a cool-down after the last exercise, picked from the library
-- like the warm-up. All three are optional. The member's order:
--   intro → warm-up (if on) → the exercises → "Cool down?" → cool-down (if yes)
--   → outro → Workout complete
-- Run in the Supabase SQL Editor after 017_workout_ratings.sql.

-- ── Cool-downs in the exercise library ────────────────
-- Like a warm-up: one video that plays once, start to finish (role
-- 'cooldown'). Members are asked at the end whether to take it; there's no
-- switch for it up front.
alter table public.exercises drop constraint exercises_kind_check;
alter table public.exercises add constraint exercises_kind_check
  check (kind in ('exercise', 'warmup', 'cooldown'));

alter table public.exercise_videos drop constraint exercise_videos_role_check;
alter table public.exercise_videos add constraint exercise_videos_role_check
  check (role in ('tutorial', 'loop', 'loop_right', 'loop_left', 'warmup', 'cooldown'));

-- Restrict, as for the warm-up: a cool-down in use can be archived, not deleted.
alter table public.workouts
  add column cooldown_exercise_id uuid references public.exercises(id) on delete restrict;

-- ── Intro and outro videos ────────────────────────────
-- Uploaded in the builder, one of each per workout. Same lifecycle as
-- exercise_videos: the live clip for a role is its newest *ready* row; a newer
-- row that isn't ready yet is a replacement in progress, and the older rows
-- (and their Mux assets) go once it's ready. Deleting the workout deletes the
-- rows; the server deletes the Mux assets first.
create table public.workout_videos (
  id                 uuid default gen_random_uuid() primary key,
  workout_id         uuid not null references public.workouts(id) on delete cascade,
  role               text not null check (role in ('intro', 'outro')),
  status             text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'errored')),
  mux_upload_id      text,
  mux_asset_id       text,
  mux_playback_id    text,
  -- The MP4 static rendition the player loads, e.g. '1080p.mp4'.
  mp4_file           text,
  duration_seconds   numeric,
  original_filename  text,
  error              text,
  created_at         timestamptz default now() not null
);
create index workout_videos_workout_role_idx
  on public.workout_videos(workout_id, role, created_at desc);

-- Read and written only on the server (service role), like the other workout tables.
alter table public.workout_videos enable row level security;
