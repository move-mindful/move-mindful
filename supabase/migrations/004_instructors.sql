-- Move Mindful — Instructors
-- A teacher entity with a profile photo, linked one-per-class from `classes`.
-- Run in the Supabase SQL Editor.

-- ── Instructors ───────────────────────────────────────
create table public.instructors (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  avatar_url  text,
  created_at  timestamptz default now() not null
);

-- ── Link classes → instructor (one per class) ─────────
alter table public.classes
  add column instructor_id uuid references public.instructors(id) on delete set null;
create index classes_instructor_id_idx on public.classes(instructor_id);

-- ── Backfill ──────────────────────────────────────────
-- Create one instructor per distinct existing name, then link the classes.
-- Existing names come over as-is (likely full names); rename them to first
-- names in the admin afterward.
insert into public.instructors (name)
select distinct trim(instructor_name)
from public.classes
where coalesce(trim(instructor_name), '') <> '';

update public.classes c
set instructor_id = i.id
from public.instructors i
where trim(c.instructor_name) = i.name;

-- The old free-text column becomes a transitional mirror. Reads now prefer the
-- joined instructor; this column is dropped in a later migration. Relax NOT NULL
-- so classes created via the instructor picker don't require it.
alter table public.classes alter column instructor_name drop not null;

-- ── Row Level Security ────────────────────────────────
-- Names + photos are public (no link to draft content). Admin writes go through
-- the service-role key (bypasses RLS), so no write policy is needed.
alter table public.instructors enable row level security;
create policy "Read instructors" on public.instructors for select using (true);

-- ── Storage bucket for instructor avatars ─────────────
-- Public bucket: avatars are served via public URLs. Uploads run server-side
-- with the service-role key (which bypasses storage RLS), so no public write
-- policy is added.
insert into storage.buckets (id, name, public)
values ('instructor-avatars', 'instructor-avatars', true)
on conflict (id) do nothing;
