-- Move Mindful — Voice announcements (Phase 4.5)
-- A short spoken line as each rest and each exercise begins in the player —
-- "Starting rest, 30 seconds." / "Begin, bicep curl, 10 reps." — made with
-- ElevenLabs text to speech when a workout is saved in the builder, and
-- shared by every workout that says the same words in the same voice.
-- Run in the Supabase SQL Editor after 023_warmup_block.sql.

-- ── The lines ─────────────────────────────────────────
-- One row per line made: its words, the voice and model that said them, and
-- how long the speech runs (the player times the exercise's name on screen,
-- and the step's audio tip, by it). `key` (a hash of the voice, model and
-- words) names its file in the bucket below. `characters` is what ElevenLabs
-- charged for it. Read and written only on the server: RLS on, no policies.
create table if not exists public.voice_lines (
  key         text primary key,
  text        text not null,
  voice_id    text not null,
  model_id    text not null,
  seconds     real not null check (seconds > 0),
  characters  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.voice_lines enable row level security;

-- ── The recordings ────────────────────────────────────
-- Public bucket, like the audio tips: files are served by their public URLs.
-- Uploads run server-side with the service-role key, so no write policy.
insert into storage.buckets (id, name, public)
values ('voice-lines', 'voice-lines', true)
on conflict (id) do nothing;
