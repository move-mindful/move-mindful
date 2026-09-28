-- Move Mindful — Member preferences (Phase 4.5)
-- Run in the Supabase SQL Editor after 011_workout_set_rest_and_cover.sql.
--
-- A member's settings, kept on their account so they follow them to every
-- device. One row per member, keyed by their Clerk user id, with the settings
-- as JSON grouped by area — `workoutPlayer` for now: tutorialMode ('loop' |
-- 'once' | 'off'), instructorAudio and warmup (booleans). New settings need no
-- migration; the server validates what it reads and writes
-- (apps/web/src/lib/member/preferences.ts).
--
-- Only the server touches it, with the service-role key, taking the member
-- from their Clerk session — never from the request. RLS is on with no
-- policies, so the browser can't read or write it directly.

create table public.member_preferences (
  clerk_user_id  text primary key,
  preferences    jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.member_preferences enable row level security;
