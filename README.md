# Move Mindful

A video fitness platform with on-demand classes, livestreaming, push notifications, and community features. Web and iOS are co-equal platforms — the web is the storefront (where purchases happen), the iOS app is the logged-in experience.

## Current Status

**Phase 4 complete — admin CMS (Mux sync, tags, collections) and a curated, collection-based member browse, on top of Mux video, RevenueCat payments, and entitlement gating.** (See the full build order with checkmarks in [plan.md](./plan.md).)

What's in place:

- Turborepo monorepo with npm workspaces
- `packages/core` — shared TypeScript types (`User`, `VideoClass`, `Tag`, `TagGroup`, `Collection`, `Challenge`, `UserAccess`, etc.) and access-control helpers (`hasAccess()`, `isChallengeExpiringSoon()`, `shouldShowUpsell()`). Consumed as source by web and mobile (no separate build step)
- `apps/web` — Next.js 16 app with Tailwind CSS v4
  - **Clerk authentication** — sign-in/sign-up, `ClerkProvider`, route protection via `proxy.ts`. Admin gating via `publicMetadata.role` (a session-token claim) checked optimistically in the proxy and authoritatively server-side with `requireAdmin()`.
  - **Mux video** — class catalog and individual class pages with `@mux/mux-player-react` (adaptive streaming, AirPlay), thumbnails from Mux.
  - **RevenueCat + Stripe payments** — pricing page, Web Billing purchase flow, "Move Mindful Pro" entitlement gating member routes.
  - **Admin CMS** (`/admin`, admin-only) — **classes**: Sync from Mux (list assets → import), **Trim & import** (clip a recording's dead air into a new Mux asset and publish only the trimmed clip, with a one-click "delete raw recording" once the clip is ready), create/edit, request a temporary Mux master MP4 download for offline editing, publish/unpublish, delete (with optional Mux asset deletion), assign an instructor; class title edits sync back to the Mux asset's `meta.title` so videos are searchable in the Mux dashboard; **instructors**: teachers with an uploaded profile photo (client-side square-cropped, stored in Supabase Storage), one assigned per class; **tags**: tag groups + tags (create/rename/delete, cascade-safe); **collections**: manual (hand-picked + up/down order) and smart (tag-rule, auto-resolved), publish, row ordering, a per-collection display limit, and an "auto-add new classes to the top" toggle (manual) that pushes every newly created class onto the collection. All writes go through server actions using the Supabase service-role key (`server-only`).
  - **Member browse** (`/classes`) — curated **collection carousels** (manual + smart, ordered, each capped at its display limit); class card/detail metadata derived from tags (Discipline label · Intensity badge · Focus/Vibe chips), with the instructor's avatar + name (single-initial fallback) on cards and the class page. Curation-only: a class appears only if it's in a published collection.
  - **Live** (`/live`) — a persistent full-width Mux live stream (`streamType="live"`, playback ID via `NEXT_PUBLIC_MUX_LIVESTREAM_PLAYBACK_ID`), a viewer-local "next class" countdown banner (Luxon), and a hardcoded recurring weekly schedule rendered as a month calendar (class times defined in Arizona time, converted to the viewer's local timezone, prev/next month nav).
  - **Account Settings** (`/account`) — plan status and profile.
  - **Custom user menu** — Clerk user info synced to RevenueCat.
  - **Supabase database** — `user_profiles`, `classes`, `instructors`, `tags`, `tag_groups`, `class_tags`, `collections`, `collection_classes`, `collection_rule_tags`, all with RLS (read-only for members; admin writes via service-role). Instructor avatars live in a public `instructor-avatars` Storage bucket.
  - **Deployed to Vercel** — live at `www.movemindful.com`. Auto-deploys on push to `main`.
- `apps/mobile` — Expo 56 / React Native app (starter screen, no integrations yet)
- Shared `tsconfig.base.json` for consistent TypeScript settings across packages

What's not yet built:
- In-browser Mux direct upload (admins upload in the Mux dashboard, then Sync) and Mux livestream recording import (deferred to Phase 7)
- 30-day challenge expiry tracking and upsell flow
- iOS app (Expo + React Native)
- Push notifications
- Group chat and livestreaming (deferred to later phases per plan)

## Known tech debt / dormant code

Tracked here so it doesn't get lost. None of these affect current functionality — they're cleanup waiting on confidence or a future migration.

**Dormant / transitional database columns** (on `public.classes`):

| Column | Status | Notes |
|---|---|---|
| `instructor_name` | Transitional | Superseded by `instructor_id` + the `instructors` join (migration `004`). Still read as a fallback (`inst?.name ?? instructor_name`) but **no longer written**. Drop in a future migration once confident nothing depends on it. |
| `category`, `difficulty` | Deprecated | Replaced by the unified tags model in Phase 4. **No code references remain.** `supabase/migrations/003_drop_legacy_class_columns.sql` drops them — apply it in Supabase if it hasn't been run yet. |
| `thumbnail_url` | Dormant | Never read. Thumbnails are generated from the Mux playback ID (`image.mux.com/<id>/thumbnail.webp`). The `VideoClass.thumbnailUrl` field in `packages/core` is likewise unused by the web app. |

**Dormant code:**

- **Admin dashboard** — `/admin` redirects to `/admin/classes`; the original dashboard UI is parked (unrendered) in `apps/web/src/components/admin/admin-dashboard.tsx`, kept in case the `/admin` slot is repurposed. Re-route it from `apps/web/src/app/admin/page.tsx` to bring it back.

**Performance / cost trade-offs:**

- **Per-load Mux status fetch on the Classes overview** — the admin Classes list (`getAdminClasses`) fetches Mux encode-status for every trimmed clip that still has a `source_mux_asset_id` (to gate each row's "Delete raw" button), on every page load. Normally 0–few calls — they clear as raws are deleted — but it scales with the number of un-cleaned clips. If that grows, cache the status or move readiness to a Mux webhook that writes a `clip_ready`/status column instead of polling per render.

## Tech Stack

| Layer | Tool |
|---|---|
| Language | TypeScript |
| Web | React + Next.js (Vercel) |
| Mobile | React Native / Expo |
| Monorepo | Turborepo |
| Auth | Clerk |
| Payments | RevenueCat (Stripe on web) |
| Video | Mux |
| Database | Supabase (Postgres) |
| Push Notifications | Expo Notifications |

## Project Structure

```
move-mindful/
├── apps/
│   ├── web/               # Next.js 16 + Tailwind CSS v4
│   │   ├── src/proxy.ts   # Clerk middleware (route + optimistic admin gating)
│   │   ├── src/lib/       # supabase (anon + service-role), mux, auth, admin queries, collections
│   │   ├── src/components/# Mux player, user menu, entitlement gate, carousel, admin/*
│   │   └── src/app/       # App Router
│   │       ├── page.tsx        # Public landing (redirects signed-in → /classes)
│   │       ├── pricing/        # Pricing page (RevenueCat offerings + purchase)
│   │       ├── sign-in/        # Clerk <SignIn />
│   │       ├── sign-up/        # Clerk <SignUp />
│   │       ├── actions/        # Server actions (classes, tags, collections)
│   │       ├── admin/          # Admin CMS: classes, tags, collections (admin-only)
│   │       └── (member)/       # Protected: classes (carousels), classes/[id], account
│   └── mobile/            # Expo 56 / React Native
│       └── App.tsx        # Entry point
├── packages/
│   └── core/              # Shared TypeScript
│       └── src/
│           ├── types.ts   # User, VideoClass, Tag, TagGroup, Collection, Challenge, …
│           ├── access.ts  # hasAccess, isChallengeExpiringSoon, shouldShowUpsell
│           └── index.ts   # Re-exports
├── supabase/migrations/   # SQL migrations (001 schema, 002 media org, 003 cleanup, 004 instructors, 005 collection auto-add + limit, 006 clip source tracking)
├── plan.md                # Full architecture, build order, security guidelines
├── phase-4-plan.md        # Phase 4 implementation plan (schema, routes, decisions)
├── turbo.json             # Turborepo task config
├── tsconfig.base.json     # Shared TypeScript compiler options
└── package.json           # Root workspace config
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 11+

### Install dependencies

```bash
npm install
```

### Environment variables

The web app needs Clerk, Supabase, RevenueCat, and Mux keys. Copy the template and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Get the `pk_test_…` and `sk_test_…` keys from the [Clerk dashboard](https://dashboard.clerk.com). `.env.local` is gitignored; never commit real keys.

### Development

```bash
# Run everything (web + mobile + core)
npm run dev

# Run just the web app
npm run dev:web

# Run just the mobile app
npm run dev:mobile
```

### Build

```bash
# Build all packages
npm run build

# Build just the web app
npm run build:web
```

### Lint

```bash
npm run lint
```

## Architecture & Planning

See [plan.md](./plan.md) for:

- Full tech stack rationale
- Business model (30-day challenge → membership upsell)
- Purchasing & platform strategy
- 8-phase build order
- Hosting & cost breakdown
- Security guidelines and checklist
