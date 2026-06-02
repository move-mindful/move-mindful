-- Move Mindful — Collection auto-add + per-collection display limit
-- Run in the Supabase SQL Editor.

alter table public.collections
  add column auto_add_new  boolean not null default false,
  add column display_limit integer;  -- null = no limit (show all)

-- Configure the existing "Latest Classes" collection (case-insensitive title):
-- make it manual, auto-add new classes to the top, and cap the row at 16.
update public.collections
set kind = 'manual', auto_add_new = true, display_limit = 16
where lower(title) = 'latest classes';

-- Backfill: add every existing class to "Latest Classes", newest-first — the
-- smallest position sorts first, so the newest class leads. Future imports get
-- even smaller (negative) positions, keeping newest on top.
insert into public.collection_classes (collection_id, class_id, position)
select c.id,
       cl.id,
       (row_number() over (order by cl.created_at desc))::int - 1
from public.collections c
cross join public.classes cl
where lower(c.title) = 'latest classes'
on conflict (collection_id, class_id) do nothing;
