-- Move Mindful — Workout ratings
-- Members rate a workout out of five stars on its "Workout complete" screen:
-- one rating per member per workout, changed by rating again. The admin sees
-- each workout's average and count (the workouts list and the builder), and a
-- member's highly rated workouts can later inform workouts generated for them.
-- Run in the Supabase SQL Editor after 016_exercise_pairings.sql.

create table public.workout_ratings (
  clerk_user_id  text not null,
  workout_id     uuid not null references public.workouts(id) on delete cascade,
  stars          smallint not null check (stars between 1 and 5),
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  primary key (clerk_user_id, workout_id)
);
create index workout_ratings_workout_idx on public.workout_ratings(workout_id);

-- Member-owned, read and written only on the server (the member from their
-- Clerk session): RLS on, no policies. Cleared by deleteMemberData().
alter table public.workout_ratings enable row level security;
