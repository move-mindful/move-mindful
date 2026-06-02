-- Move Mindful — Trimmed-clip source tracking
-- Run in the Supabase SQL Editor.

-- When a class is created by trimming a livestream recording, the published
-- video is a Mux *clip* (a separate, re-encoded asset containing only the kept
-- footage). We keep the source (raw, untrimmed) asset id here so an admin can
-- delete the original recording once the clip is ready. Null when the class is
-- not a clip, or after the raw recording has been cleaned up.
alter table public.classes
  add column source_mux_asset_id text;

comment on column public.classes.source_mux_asset_id is
  'Raw (untrimmed) Mux asset id behind a trimmed clip, kept so the original recording can be deleted. Null otherwise.';
