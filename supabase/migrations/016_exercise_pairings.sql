-- Move Mindful — Exercise pairings
-- "Pairs well with" in the exercise form: exercises the admin likes grouped
-- together in a superset or circuit. A pairing goes both ways, so each pair is
-- stored once, smaller id first. "Generate with AI" prefers these pairings, and
-- the builder suggests them when adding to a superset or circuit.
-- Run in the Supabase SQL Editor after 015_app_settings.sql.

create table public.exercise_pairings (
  exercise_a  uuid not null references public.exercises(id) on delete cascade,
  exercise_b  uuid not null references public.exercises(id) on delete cascade,
  created_at  timestamptz default now() not null,
  primary key (exercise_a, exercise_b),
  constraint exercise_pairings_order check (exercise_a < exercise_b)
);
create index exercise_pairings_b_idx on public.exercise_pairings(exercise_b);

-- Admin reads and writes go through the service-role key: RLS on, no policies.
alter table public.exercise_pairings enable row level security;
