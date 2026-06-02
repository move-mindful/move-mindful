-- Move Mindful — Phase 4: Media Organization
-- Tags (unified taxonomy), tag groups, and collections (manual + smart).
-- Run in the Supabase SQL Editor.

-- ── Tag Groups ────────────────────────────────────────
-- Optional grouping for tags (e.g. Discipline, Intensity, Focus, Vibe).
create table public.tag_groups (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  slug        text unique not null,
  position    integer not null default 0,
  created_at  timestamptz default now() not null
);

-- ── Tags ──────────────────────────────────────────────
-- Unified taxonomy. The old `category` concept folds into tags here.
create table public.tags (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  slug        text unique not null,
  group_id    uuid references public.tag_groups(id) on delete set null,
  position    integer not null default 0,
  created_at  timestamptz default now() not null
);
create index tags_group_id_idx on public.tags(group_id);

-- ── Class ↔ Tag (many-to-many) ────────────────────────
create table public.class_tags (
  class_id  uuid not null references public.classes(id) on delete cascade,
  tag_id    uuid not null references public.tags(id) on delete cascade,
  primary key (class_id, tag_id)
);
create index class_tags_tag_id_idx on public.class_tags(tag_id);

-- ── Collections (manual or smart) ─────────────────────
create table public.collections (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  slug          text unique not null,
  description   text not null default '',
  kind          text not null default 'manual' check (kind in ('manual', 'smart')),
  match_mode    text not null default 'any'    check (match_mode in ('any', 'all')),
  position      integer not null default 0,   -- row order on the browse page
  published_at  timestamptz,                  -- null = draft
  created_at    timestamptz default now() not null
);

-- ── Manual collection membership + ordering ───────────
create table public.collection_classes (
  collection_id  uuid not null references public.collections(id) on delete cascade,
  class_id       uuid not null references public.classes(id) on delete cascade,
  position       integer not null default 0,  -- ordering within the collection
  primary key (collection_id, class_id)
);
create index collection_classes_class_id_idx on public.collection_classes(class_id);

-- ── Smart collection rule tags ────────────────────────
-- A smart collection includes classes matching these tags (any/all per match_mode).
create table public.collection_rule_tags (
  collection_id  uuid not null references public.collections(id) on delete cascade,
  tag_id         uuid not null references public.tags(id) on delete cascade,
  primary key (collection_id, tag_id)
);

-- ── Seed tag groups + tags from existing enums ────────
insert into public.tag_groups (name, slug, position) values
  ('Discipline', 'discipline', 0),
  ('Intensity',  'intensity',  1);

insert into public.tags (name, slug, group_id, position)
select v.name, v.slug, (select id from public.tag_groups where slug = 'discipline'), v.position
from (values
  ('Strength', 'strength', 0),
  ('Cardio',   'cardio',   1),
  ('Yoga',     'yoga',     2),
  ('Mobility', 'mobility', 3),
  ('HIIT',     'hiit',     4),
  ('Recovery', 'recovery', 5)
) as v(name, slug, position);

insert into public.tags (name, slug, group_id, position)
select v.name, v.slug, (select id from public.tag_groups where slug = 'intensity'), v.position
from (values
  ('Beginner',     'beginner',     0),
  ('Intermediate', 'intermediate', 1),
  ('Advanced',     'advanced',     2)
) as v(name, slug, position);

-- ── Backfill class_tags from existing columns ─────────
insert into public.class_tags (class_id, tag_id)
select c.id, t.id
from public.classes c
join public.tags t on t.slug = c.category
on conflict do nothing;

insert into public.class_tags (class_id, tag_id)
select c.id, t.id
from public.classes c
join public.tags t on t.slug = c.difficulty
on conflict do nothing;

-- ── Relax legacy columns into a permissive mirror ─────
-- Drop the NOT NULL + CHECK on category/difficulty so admins can create ANY new
-- tag (including new Disciplines/Intensities) without hitting the old enum limits.
-- (classes_category_check / classes_difficulty_check are Postgres's default names
-- for the inline CHECK constraints created in migration 001.)
-- These columns are dropped entirely in the 003 cleanup once the UI reads tags.
alter table public.classes alter column category   drop not null;
alter table public.classes alter column difficulty drop not null;
alter table public.classes drop constraint classes_category_check;
alter table public.classes drop constraint classes_difficulty_check;

-- ── Track the Mux asset id (for sync/import dedupe) ───
-- The Sync button lists Mux assets and diffs against this column to find new uploads.
-- (asset_id is the stable key; one asset can expose multiple playback_ids.)
alter table public.classes add column mux_asset_id text;
create unique index classes_mux_asset_id_key
  on public.classes(mux_asset_id) where mux_asset_id is not null;

-- ── Row Level Security ────────────────────────────────
-- Reads only. Admin writes go through the service-role key (bypasses RLS),
-- so no write policies are defined here.
alter table public.tag_groups           enable row level security;
alter table public.tags                 enable row level security;
alter table public.class_tags           enable row level security;
alter table public.collections          enable row level security;
alter table public.collection_classes   enable row level security;
alter table public.collection_rule_tags enable row level security;

-- Tag vocabulary is public — just names/groups, no link to draft content.
create policy "Read tag groups" on public.tag_groups for select using (true);
create policy "Read tags"       on public.tags       for select using (true);

-- class_tags ties tags to specific classes, so expose rows ONLY for published
-- classes — otherwise draft class ids and their tag relationships leak via the anon key.
create policy "Read class tags of published classes"
  on public.class_tags for select
  using (exists (
    select 1 from public.classes c
    where c.id = class_id and c.published_at is not null
  ));

-- Only published collections (and their membership/rules) are member-readable.
create policy "Read published collections"
  on public.collections for select using (published_at is not null);

-- Membership requires BOTH the collection AND the class to be published, so a
-- published collection that references a draft class never leaks the draft's id.
create policy "Read membership of published collections"
  on public.collection_classes for select
  using (
    exists (select 1 from public.collections c
            where c.id = collection_id and c.published_at is not null)
    and exists (select 1 from public.classes cl
                where cl.id = class_id and cl.published_at is not null)
  );

create policy "Read rule tags of published collections"
  on public.collection_rule_tags for select
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.published_at is not null
  ));
