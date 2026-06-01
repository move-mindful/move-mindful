-- Move Mindful — Initial Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- ── User Profiles ─────────────────────────────────────
-- Synced from Clerk. clerk_id is the primary link between Clerk and Supabase.

create table public.user_profiles (
  id uuid default gen_random_uuid() primary key,
  clerk_id text unique not null,
  email text not null,
  name text not null default '',
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table public.user_profiles enable row level security;

create policy "Users can read their own profile"
  on public.user_profiles for select
  using (clerk_id = auth.jwt()->>'sub');

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (clerk_id = auth.jwt()->>'sub');

-- ── Classes ───────────────────────────────────────────
-- Video class catalog. Managed by admins, readable by authenticated users.

create table public.classes (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null default '',
  instructor_name text not null,
  duration_minutes integer not null,
  thumbnail_url text,
  mux_playback_id text,
  category text not null check (category in ('strength', 'cardio', 'yoga', 'mobility', 'hiit', 'recovery')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  published_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.classes enable row level security;

create policy "Authenticated users can read published classes"
  on public.classes for select
  using (published_at is not null);
