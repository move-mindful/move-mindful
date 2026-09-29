-- Move Mindful — App settings
-- Small site-wide settings the admin edits, one row per key. First use: the
-- instructions Claude gets in the workout builder's "Generate with AI"
-- (key 'workout_generator_instructions'; no row = the built-in default).
-- Run in the Supabase SQL Editor after 014_exercise_intensity.sql.

create table public.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now() not null
);

-- Read and written only on the server with the service-role key, behind the
-- admin check: RLS on, no policies.
alter table public.app_settings enable row level security;
