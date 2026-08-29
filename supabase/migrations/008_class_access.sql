-- Move Mindful — Per-class access tier
-- Run in the Supabase SQL Editor.

-- Which RevenueCat entitlement a class requires in order to watch it.
--   null       → free: any signed-in account
--   <text>     → that entitlement identifier, e.g. 'Move Mindful Pro' for the
--                membership, or a per-product one for a one-time purchase.
--
-- One entitlement per one-time product (rather than a single shared "one-time"
-- flag) so products can be sold, bundled and comped independently — and so
-- "the membership includes everything" stays a RevenueCat dashboard decision
-- (attach the membership product to every entitlement) rather than code.
--
-- Deliberately on the class, NOT the collection. A class can belong to several
-- collections, and `collections.auto_add_new` drops every new import into one
-- automatically — so collection-derived access would quietly make a paid video
-- free the moment it landed in a free browse row. Per-class is unambiguous
-- wherever the video gets surfaced.
--
-- The default is the membership rather than null so the column fails safe in
-- both directions: existing rows backfill to members-only, and a newly imported
-- class is locked until someone deliberately marks it free. Set it to null to
-- publish a free teaser.
alter table public.classes
  add column required_entitlement text default 'Move Mindful Pro';

comment on column public.classes.required_entitlement is
  'RevenueCat entitlement required to watch. null = free to any signed-in account.';
