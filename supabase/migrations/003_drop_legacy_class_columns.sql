-- Move Mindful — Phase 4 cleanup: drop the legacy class columns
--
-- The member browse + detail UI now read tags exclusively, and the admin class
-- form no longer mirrors into these columns. Once the Step 6/7 code is deployed,
-- `category` and `difficulty` are unused redundant copies of the Discipline /
-- Intensity tags, so we drop them.
--
-- Run in the Supabase SQL Editor AFTER the Step 7 deploy is live (so the running
-- code is no longer writing to these columns).

alter table public.classes drop column if exists category;
alter table public.classes drop column if exists difficulty;
