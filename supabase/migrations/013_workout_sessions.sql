-- Move Mindful — Workout sessions (Phase 4.5, step 5)
-- Run in the Supabase SQL Editor after 012_member_preferences.sql.
--
-- One row each time a member begins a workout. The player saves it as they go
-- (at every new set), so it's there to resume even if they close the page.
-- Together the rows give:
--   · Resume — the member's in_progress session for a workout (at most one)
--   · History — their completed sessions
--   · Time since last workout — their newest completed_at
--
-- resume_step is a step index into the workout's sequence as the player
-- builds it (packages/core workoutSteps). sequence_key fingerprints that
-- sequence (packages/core sequenceKey): if the workout is edited so the steps
-- move, the key no longer matches and the saved spot is ignored.
--
-- Deleting a workout keeps its sessions (workout_id becomes null), so a
-- member's history and "last workout" survive it.
--
-- Only the server touches it, with the service-role key, taking the member
-- from their Clerk session — never from the request. RLS is on with no
-- policies, so the browser can't read or write it directly.

create table public.workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  clerk_user_id     text not null,
  workout_id        uuid references public.workouts(id) on delete set null,
  status            text not null default 'in_progress'
                    check (status in ('in_progress', 'completed', 'discarded')),
  with_warmup       boolean not null default false,
  resume_step       integer not null default 0 check (resume_step >= 0),
  sets_done         integer not null default 0 check (sets_done >= 0),
  sets_total        integer not null default 0 check (sets_total >= 0),
  percent_complete  smallint not null default 0 check (percent_complete between 0 and 100),
  -- Workout time, pauses and the warm-up excluded.
  active_seconds    integer not null default 0 check (active_seconds >= 0),
  sequence_key      text not null,
  started_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz
);

-- At most one session in progress per member per workout: beginning again
-- (Start over) discards the old one first.
create unique index workout_sessions_one_in_progress
  on public.workout_sessions (clerk_user_id, workout_id)
  where status = 'in_progress';

-- A member's sessions, newest first (workout cards, history, last workout).
create index workout_sessions_member_recent
  on public.workout_sessions (clerk_user_id, updated_at desc);

alter table public.workout_sessions enable row level security;
