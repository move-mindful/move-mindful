-- Move Mindful — Exercises (Phase 4.5, step 2)
-- The library of short vertical exercise clips that workouts are built from.
-- Run in the Supabase SQL Editor.

-- ── Exercise tags ─────────────────────────────────────
-- A flat list, deliberately separate from the class `tags` / `tag_groups`
-- taxonomy: these only filter the admin exercise library and are never shown
-- to members.
create table public.exercise_tags (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz default now() not null
);
create unique index exercise_tags_name_key on public.exercise_tags (lower(name));

-- ── Exercises ─────────────────────────────────────────
-- kind 'exercise': a tutorial plus a looping clip (one, or one per side).
-- kind 'warmup':   a single video that plays once, start to finish.
create table public.exercises (
  id               uuid default gen_random_uuid() primary key,
  kind             text not null default 'exercise' check (kind in ('exercise', 'warmup')),
  name             text not null,
  -- Right and left are filmed as separate loop clips. Which side goes first is
  -- a workout setting, not an exercise one.
  sided            boolean not null default false,
  -- No rep count (holds, stretches): workouts can only time it.
  timed_only       boolean not null default false,
  equipment        text[] not null default '{}',
  -- Every dumbbell weight that works for this exercise, as levels — never pounds.
  dumbbell_levels  text[] not null default '{}',
  -- Archived: hidden from the library and the builder search, while workouts
  -- that already use it keep working. Null = active.
  archived_at      timestamptz,
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null,
  constraint exercises_warmup_shape
    check (kind = 'exercise' or (not sided and not timed_only)),
  constraint exercises_dumbbell_levels
    check (dumbbell_levels <@ array['light', 'medium', 'heavy']::text[])
);

-- ── Exercise ↔ tag (many-to-many) ─────────────────────
create table public.exercise_tag_links (
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  tag_id       uuid not null references public.exercise_tags(id) on delete cascade,
  primary key (exercise_id, tag_id)
);
create index exercise_tag_links_tag_id_idx on public.exercise_tag_links(tag_id);

-- ── Exercise videos ───────────────────────────────────
-- One row per uploaded clip. The live clip for a role is its newest *ready*
-- row; a newer row that isn't ready yet is a replacement in progress. When the
-- replacement becomes ready the older rows for that role are deleted (and
-- their Mux assets), so members never see a gap.
--
-- role: tutorial              — with audio, plays before the exercise
--       loop                  — the looping clip
--       loop_right, loop_left — the looping clip per side (sided exercises)
--       warmup                — a warm-up's single video
create table public.exercise_videos (
  id                 uuid default gen_random_uuid() primary key,
  exercise_id        uuid not null references public.exercises(id) on delete cascade,
  role               text not null
    check (role in ('tutorial', 'loop', 'loop_right', 'loop_left', 'warmup')),
  status             text not null default 'uploading'
    check (status in ('uploading', 'processing', 'ready', 'errored')),
  mux_upload_id      text,
  mux_asset_id       text,
  mux_playback_id    text,
  -- The MP4 static rendition the player loads, e.g. '1080p.mp4' (or '720p.mp4'
  -- when the footage is too small for 1080p). Set once it's ready.
  mp4_file           text,
  duration_seconds   numeric,
  -- Loops only: how many reps the clip shows. With the duration it gives the
  -- pace used for workout time estimates. Null on a loop = not counted yet.
  reps_in_clip       integer check (reps_in_clip is null or reps_in_clip > 0),
  original_filename  text,
  error              text,
  created_at         timestamptz default now() not null
);
create index exercise_videos_exercise_role_idx
  on public.exercise_videos(exercise_id, role, created_at desc);

-- ── Row Level Security ────────────────────────────────
-- Admin reads and writes go through the service-role key (bypasses RLS). No
-- member-facing policies yet: the player (Phase 4.5 step 4) adds read access
-- when members start loading exercises.
alter table public.exercise_tags enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_tag_links enable row level security;
alter table public.exercise_videos enable row level security;

-- ── Starting tags ─────────────────────────────────────
insert into public.exercise_tags (name, position) values
  ('Upper body', 0),
  ('Lower body', 1),
  ('Shoulders', 2),
  ('Floor', 3),
  ('Standing', 4),
  ('Core', 5),
  ('Glutes', 6),
  ('Back', 7);
