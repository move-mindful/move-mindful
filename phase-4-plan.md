# Phase 4 — Backend Media Organization (Implementation Plan)

> Status: **Approved.** Decisions finalized; build proceeds in the order in §9.
> Scope decisions were gathered interactively; this doc turns them into a concrete, file-by-file plan with the exact SQL migration and route structure for review.

---

## 1. Decisions (locked)

| Area | Decision |
|---|---|
| Admin identity | Clerk `publicMetadata.role === "admin"`, checked in proxy (optimistic) **and** server (enforced) |
| DB writes | Admin-only Next.js **Server Actions** using the Supabase **service-role** key (bypasses RLS) |
| Video ingest | **Sync from Mux** — a Refresh button lists Mux assets (List Assets API), diffs against the catalog, and imports new ones (auto-fills playback ID, duration, thumbnail). Admin uploads via the Mux dashboard; full in-browser upload still deferred |
| Taxonomy | **Unified tags**, each in an optional **group**; difficulty becomes an "Intensity" group |
| Collections | **Both** manual (hand-picked, drag-to-reorder) and smart (tag-rule, auto-synced) |
| Member browse | **Collection carousels only** — strictly curated; admin sees an "unlisted" indicator |
| Class metadata UI | Group→style rendering (see §12): Intensity = colored badge (unchanged), Discipline = text label, Focus/Vibe = chips. Discipline + Intensity are **single-select** in the admin form |
| Livestream import | Deferred (overlaps Phase 7) |

### Explicitly out of scope this round
- In-browser Mux **direct upload** flow (admins upload via the Mux dashboard, then Sync; browser upload deferred to its own task).
- Mux **webhook** auto-ingest (the Sync button is admin-triggered; a `video.asset.ready` webhook is a future upgrade).
- Mux **livestream recording import / clipping**.
- Member-facing **search** and an all-classes grid (curation-only browse, by decision).

---

## 2. Key framework constraints (Next.js 16, verified against local docs)

- **`proxy.ts` (was middleware):** use only for an *optimistic* redirect of non-admins. Per docs, it is **not** an authorization solution.
- **Server Actions:** reachable via direct POST, so **every action must call `requireAdmin()` itself** — the route/layout gate is not sufficient on its own.
- Use `revalidatePath()` / `redirect()` from `next/cache` + `next/navigation` after mutations.

---

## 3. The "legacy columns" transition (important)

The current `classes` table has **`category`** and **`difficulty`** as `NOT NULL` + `CHECK` columns, and the live UI reads them directly. We're moving to tags as the source of truth, but to **avoid any broken intermediate state**, the transition is staged:

- **Migration 002 (this phase):** add the new tag/collection tables and **backfill** existing `category`/`difficulty` into `class_tags`. Keep the old columns but **drop their `NOT NULL` + `CHECK` constraints** so they become a *permissive* mirror — this is what lets you create any new tag (including new Disciplines/Intensities) without hitting the original enum limits.
- **Admin class form:** when an admin picks a Discipline tag + Intensity tag, the action *also* writes the matching slugs back into the legacy `category`/`difficulty` columns (now unconstrained strings, since the CHECK was dropped), so the existing detail/card UI keeps rendering unchanged at every commit.
- **Migration 003 (follow-up, tracked):** once the member browse + detail UI read exclusively from tags, drop the `category`/`difficulty` columns and their CHECK constraints.

This means tags become the real source of truth immediately, the legacy columns are a redundant mirror, and nothing ever renders blank mid-phase. Dropping the columns is a clean, separate, low-risk cleanup.

---

## 4. Database migration — `supabase/migrations/002_phase4_media_organization.sql`

```sql
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
  position       integer not null default 0,  -- drag-to-reorder within the collection
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
alter table public.tag_groups          enable row level security;
alter table public.tags                enable row level security;
alter table public.class_tags          enable row level security;
alter table public.collections         enable row level security;
alter table public.collection_classes  enable row level security;
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
```

**Note:** the join-table policies are scoped to `published_at is not null` on the **class** (not just the collection), so a draft class added to a published collection leaks **neither its row nor its id/tag relationships** to the anon client — closing the gap where `class_tags`/`collection_classes` could otherwise expose draft class ids. Admin screens read via the service-role client (bypasses RLS) and therefore see drafts.

---

## 5. Shared types — `packages/core/src/types.ts`

Add (keeping existing types intact during the transition):

```ts
export interface TagGroup {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  groupId?: string;
  position: number;
}

export type CollectionKind = "manual" | "smart";
export type MatchMode = "any" | "all";

export interface Collection {
  id: string;
  title: string;
  slug: string;
  description: string;
  kind: CollectionKind;
  matchMode: MatchMode;
  position: number;
  publishedAt?: Date;
}
```

`VideoClass` gains an optional `tags?: Tag[]` (hydrated reads) and `muxAssetId?: string` (the Mux sync key).

**Transitional typing (important):** because migration 002 drops the `category`/`difficulty` CHECK constraints so admins can create *any* new Discipline/Intensity tag (§3), the legacy mirror columns can now hold values outside the original unions. So during the transition the DB-facing `category`/`difficulty` fields are typed as **`string | null`**, not the `ClassCategory`/`Difficulty` unions. Those two unions are demoted to *known-legacy hints* (used only to pick default badge colors) and deleted with the columns in 003. Tags (`Tag.slug: string`) are the real source of truth — no display code may assume the value is one of the legacy enum members.

---

## 6. Route & file structure

New / changed files in `apps/web/src`:

```
proxy.ts                         # CHANGE: add optimistic /admin gate
types/globals.d.ts               # NEW: Clerk session-claims typing (role)

lib/
  auth/admin.ts                  # NEW: requireAdmin(), isAdmin() — server-side
  supabase/admin.ts              # NEW: service-role client (server-only)
  mux/client.ts                  # NEW: server-only Mux SDK client (List Assets, etc.)
  collections.ts                 # NEW: resolve manual + smart collections → class lists

app/
  admin/
    layout.tsx                   # NEW: requireAdmin() gate + admin nav shell
    page.tsx                     # NEW: dashboard (counts + quick links)
    classes/
      page.tsx                   # NEW: list ALL classes (drafts + "unlisted" flag)
      import/page.tsx            # NEW: "Sync from Mux" — discovered un-imported assets
      new/page.tsx               # NEW: create (prefilled from a Mux import)
      [id]/page.tsx              # NEW: edit
    tags/
      page.tsx                   # NEW: manage groups + tags
    collections/
      page.tsx                   # NEW: list collections (reorder rows)
      new/page.tsx               # NEW: create (manual or smart)
      [id]/page.tsx              # NEW: edit membership/order or rule
  actions/
    classes.ts                   # NEW: 'use server' CRUD + syncFromMux()/importMuxAsset() (requireAdmin in each)
    tags.ts                      # NEW: 'use server'
    collections.ts               # NEW: 'use server'
  (member)/
    classes/page.tsx             # CHANGE: flat grid → collection carousels
    classes/[id]/page.tsx        # CHANGE (step 6): read display tags, not columns

components/
  admin/
    class-form.tsx               # NEW: title/desc/instructor/duration + tag pickers (playback ID/duration prefilled from Mux import)
    tag-manager.tsx              # NEW
    collection-editor.tsx        # NEW: up/down ordering (manual) / tag-rule builder (smart)
  collection-carousel.tsx        # NEW: member-facing horizontal row
```

> `/admin` lives **outside** the `(member)` group on purpose: admins must not be forced through the RevenueCat `EntitlementGate` (an admin needn't be a paying member). `/admin` gets its own server-side gate.

---

## 7. Admin auth — implementation detail

**One-time Clerk dashboard step (needs your action):** in Clerk → **Sessions → Customize session token**, add:
```json
{ "metadata": "{{user.public_metadata}}" }
```
This surfaces `publicMetadata` as `sessionClaims.metadata` so the role is readable in proxy and server components **without an extra API call**. You'll also set `publicMetadata.role = "admin"` on your own user (Clerk dashboard → Users → your user → Metadata).

**`types/globals.d.ts`:**
```ts
export {};
declare global {
  interface CustomJwtSessionClaims {
    metadata?: { role?: "admin" };
  }
}
```

**`proxy.ts` (optimistic redirect):**
```ts
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
// inside clerkMiddleware handler, after the existing signed-in check:
if (isAdminRoute(req)) {
  const { sessionClaims } = await auth();
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.redirect(new URL("/classes", req.url));
  }
}
```

**`lib/auth/admin.ts` (the real enforcement):**
```ts
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export async function isAdmin() {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata?.role === "admin";
}

export async function requireAdmin() {
  if (!(await isAdmin())) notFound(); // 404, not a redirect — don't reveal /admin exists
}
```

`admin/layout.tsx` calls `await requireAdmin()`, and **every server action** in `app/actions/*` calls it first. The same `import "server-only";` guard goes at the top of `lib/mux/client.ts` (carries `MUX_TOKEN_SECRET`) and `lib/auth/admin.ts`. Requires the tiny `server-only` package (`npm i server-only`).

**`lib/supabase/admin.ts` (service-role, server-only):**
```ts
import "server-only"; // build-time guard: importing this from a Client Component fails the build
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // already in .env.example
    { auth: { persistSession: false } }
  );
}
```

---

## 8. Smart collection resolution — `lib/collections.ts`

For v1, resolve in TypeScript (no DB view/RPC needed yet):
- **Manual:** read `collection_classes` ordered by `position`, hydrate published classes.
- **Smart:** read `collection_rule_tags`; fetch published classes having **any** / **all** of those tags (per `match_mode`) via `class_tags`.
- Member browse uses the **anon/RLS** server client so only published classes/collections surface. Admin previews can use the service-role client.

(If smart-collection queries get heavy later, promote this to a Postgres function — noted as a possible future optimization, not needed now.)

---

## 9. Build order (each step independently shippable, no broken state)

1. **Admin foundation** — `globals.d.ts`, `lib/auth/admin.ts`, `lib/supabase/admin.ts`, `proxy.ts` gate, `admin/layout.tsx` + empty `admin/page.tsx`. Verify: non-admin → redirect/404; admin → empty shell.
2. **Migration 002** — run SQL; add core types. Verify: tables + backfill present, member site unchanged.
3. **Admin class management** — list (drafts + unlisted flag); **Sync from Mux** (Refresh → discovered assets → import pre-fills playback ID/duration/thumbnail) → finish in the class form (title, instructor, description, tags; mirror legacy columns); publish/unpublish; delete (see §13). Actions in `app/actions/classes.ts` incl. `syncFromMux`/`importMuxAsset`.
4. **Admin taxonomy** — create/edit/delete tag groups + tags (`app/actions/tags.ts`). Any tag in any group can be created freely (no enum limits — see §3). Deleting a tag is cascade-safe; the UI confirms with a "used by N classes · M collections" count first.
5. **Admin collections** — manual (up/down ordering) + smart (tag rule), publish, row ordering (`app/actions/collections.ts`).
6. **Member browse** — replace flat grid with ordered collection carousels; switch card/detail display to derive metadata from tags per the group→style rules in §12. Thumbnails stay Mux-derived (the `thumbnail_url` column remains unused for now).
7. **Docs + cleanup** — tick [plan.md](plan.md) Phase 4 items, update [README.md](README.md). Then (separately) **migration 003** to drop the legacy `category`/`difficulty` columns.

---

## 10. Verification plan

- After step 1: hit `/admin` as non-admin (expect 404/redirect) and as admin (expect shell) via the preview server.
- After each admin step: create → edit → publish → confirm via the member side and a fresh DB read.
- After step 6: confirm carousels render curated + smart rows in order; confirm a draft class in a collection does **not** appear (RLS check); confirm an "unlisted" published class is flagged in admin.

---

## 11. Open items — resolved

| Item | Decision |
|---|---|
| **Taxonomy read scope** | **Public reads** (`using (true)`) — matches the existing `classes` posture. Reflected in §4. |
| **Thumbnails** | **Mux-derived only** — no custom field; `thumbnail_url` column stays unused for now. |
| **Reordering** | **Up/down buttons first** — no new dnd dependency; can upgrade later. |

### Still pending — your action (not code)
- **Clerk session-token customization** (§7): in Clerk → Sessions → Customize session token, add `{ "metadata": "{{user.public_metadata}}" }`, and set `publicMetadata.role = "admin"` on your own user. The admin gate depends on this. *(Can be done anytime before testing step 1.)*
- **Mux API tokens** in `.env.local`: the Sync button needs `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` (already in `.env.example`) populated with real values. *(Needed before testing step 3, not step 1.)*

---

## 12. UI metadata rendering

Driven by **tag group → display style**, so cards and the detail page aren't hardcoded to specific columns. **The difficulty badge does not change** — it simply reads the class's Intensity-group tag instead of the `difficulty` column. Same pill, same colors.

| Group | Rendered as |
|---|---|
| **Intensity** | colored badge — beginner→emerald, intermediate→amber, advanced→red (same as today) |
| **Discipline** | neutral text label, e.g. "Strength" (same as today) |
| **Focus / Vibe / ungrouped** | muted chips |

- **Card (browse carousels):** Discipline label · Intensity badge · duration overlay. Extra-group chips are **not** shown on cards, to keep them clean.
- **Detail page:** Discipline label · Intensity badge · duration, plus a row of muted Focus/Vibe/ungrouped chips below the description.
- **Admin class form:** Discipline and Intensity are **single-select** (one each) so the label/badge stay tidy; Focus/Vibe/ungrouped are **multi-select**. The DB stays many-to-many — this is a form convention; the server action enforces "≤1 each" (see §14), not the schema.
- **Unknown slugs:** the group→style mapping must fall back to a neutral style for any slug it doesn't recognize (e.g. a newly-created Intensity `expert` or Discipline `meditation`). Today's card already does this (`difficultyColor[...] ?? neutral`); the tag-based rewrite must **preserve** that default rather than hard-coding the 3 legacy intensities / 6 legacy disciplines.

```
CARD                                   DETAIL
┌─────────────────────┐                Strength · [Beginner] · 30 min
│ [thumb]      30 min │                Vinyasa Flow
├─────────────────────┤                with Sarah Chen
│ Strength · [Beginner]│               <description>
│ Vinyasa Flow         │               Core  Morning  Low-impact   ← Focus/Vibe chips
│ Sarah Chen           │
└─────────────────────┘
```

> Default taken on the one unanswered sub-point: extra Focus/Vibe chips appear on **detail only**, not cards. Trivial to flip if you'd rather show them on cards.

---

## 13. Removing a video — unpublish vs delete (and the Mux boundary)

Two distinct actions in the class admin:

- **Unpublish** *(reversible)* — sets `published_at = null`. Hides the class from members immediately (pulls it from every carousel) but keeps the catalog row, its tags, and collection memberships. Re-publish anytime. **This is the normal way to take a class off the member side.**
- **Delete** *(hard)* — removes the `classes` row. Cascades cleanly via `on delete cascade` on `class_tags` and `collection_classes` (no orphaned rows). The UI confirms with an "in N collections" count first.

**Mux boundary:** Delete defaults to removing the **catalog entry only**, but the confirm dialog includes an **opt-in checkbox — "Also delete the video from Mux (permanent)"** — unchecked by default with a clear irreversible-action warning. When checked, the `deleteClass` action also calls Mux's **Delete Asset** API for the stored `mux_asset_id` (via `lib/mux/client.ts`), so the source file is removed from Mux too. The option is **disabled for any class without a `mux_asset_id`** (e.g. legacy rows never synced), since there's no asset to target.

**Interaction with Sync:**
- **Delete (catalog only):** the Mux asset survives, so the next **Sync from Mux** re-surfaces it as "new / un-imported." Use **unpublish** instead to retire a class from members without it reappearing.
- **Delete + remove from Mux:** the asset is gone, so it won't come back on sync — the one-step "fully retire this video" path.
- *(Future, not built: an "ignore this asset" dismissal to suppress re-discovery of intentionally-skipped assets you keep in Mux.)*

---

## 14. Server-side validation — the enforcement boundary

Server Actions are POST-reachable (§2), so the form UI is **not** an integrity boundary. Beyond `requireAdmin()`, each action enforces the domain invariants below. The schema is intentionally kept flexible (many-to-many, no kind-specific constraints), so **the actions own correctness**:

- **Class tags:** at most **one** tag from the **Discipline** group and at most **one** from the **Intensity** group per class (reject 2+). Other groups are unrestricted. The single-select form is convenience; the action is the guarantee.
- **Collection shape by `kind`:**
  - `kind = 'manual'` → may have `collection_classes` rows; must have **no** `collection_rule_tags`.
  - `kind = 'smart'` → may have `collection_rule_tags`; must have **no** `collection_classes` rows.
- **Mirror writes:** the legacy `category`/`difficulty` columns are written **only** from the chosen Discipline/Intensity tag slugs (§3) — never from arbitrary client input.
- **Mux import:** `importMuxAsset` verifies the asset is `ready` and has a usable public playback id before creating a class; `mux_asset_id` uniqueness is also backed by the DB index.
- **Standard input validation:** required fields, numeric/positive duration, slug format + uniqueness — all validated server-side, not just in the form.
```
