# Move Mindful

A video fitness platform with on-demand classes, livestreaming, push notifications, and community features. Web and iOS are co-equal platforms — the web is the storefront (where purchases happen), the iOS app is the logged-in experience.

## Current Status

**Phase 4 complete — admin CMS (Mux sync, tags, collections) and a curated, collection-based member browse, on top of Mux video, RevenueCat payments, and entitlement gating.** (See the full build order with checkmarks in [plan.md](./plan.md).)

> **Product status — the class library and live stream are paused.** What's for sale is a
> one-time-purchase product with lifetime access, `Posture & Mobility Reset` (`/posture`,
> five videos), alongside a free lead magnet (`/posture-routine`); the on-demand
> library and live classes will return later under the recurring membership. So `/classes`
> and `/live` are hidden from the member nav and locked to admins (`requireSectionUnlocked()`
> in `lib/auth/locked-sections.ts`) — built and previewable, but not reachable by members.
> Signed-in users land on `/home` instead (`MEMBER_HOME` in `lib/routes.ts`).

What's in place:

- Turborepo monorepo with npm workspaces
- `packages/core` — shared TypeScript types (`User`, `VideoClass`, `Tag`, `TagGroup`, `Collection`, `Challenge`, `UserAccess`, etc.) and access-control helpers (`hasAccess()`, `isChallengeExpiringSoon()`, `shouldShowUpsell()`). Consumed as source by web and mobile (no separate build step)
- `apps/web` — Next.js 16 app with Tailwind CSS v4
  - **Clerk authentication** — sign-in/sign-up, `ClerkProvider`, route protection via `proxy.ts`. Admin gating via `publicMetadata.role` (a session-token claim) checked optimistically in the proxy and authoritatively server-side with `requireAdmin()`.
  - **Mux video** — class catalog and individual class pages with `@mux/mux-player-react` (adaptive streaming, AirPlay), thumbnails from Mux. Full-width video theater stage on the class detail page (viewport-height-capped, black background).
  - **RevenueCat + Stripe payments** — public pricing page (offerings/prices render for logged-out visitors via an anonymous RevenueCat config; sign-up is only required at the point of purchase, after which Clerk's `AFTER_SIGN_UP_URL` returns them to `/pricing` to check out), Web Billing purchase flow, "Move Mindful Pro" entitlement gating member routes.
  - **One-time products** (`/[product]`, `/[product]/[video]`) — short video series sold outright, defined in `lib/products.ts`: a slug, a RevenueCat entitlement + product id, and a list of Mux playback ids. Adding a product is an entry in that list — the sales page, the player routes, the `/home` card and the access check all read from it, and `proxy.ts` derives the public-route list from it so each sales page loads signed out. `entitlement: null` marks a product free to anyone with an account (used for the `12 Minute Posture Routine` lead magnet). The entitlement check runs server-side, so playback ids are never sent to a browser that isn't entitled to them. Buyers get a video library; a single-video product they own renders straight into the theater layout.
  - **Bespoke sales pages** — a product can override the generic unowned view with its own long-form landing page via `CUSTOM_LANDINGS` in `(app)/[product]/page.tsx`; everything else falls through to the default layout, so a new product still needs no code changes. `Posture & Mobility Reset` (`/posture`) is the first: hero, the five days, teacher bio, testimonials, and a medical disclaimer, in its own typeface and palette (`components/products/posture-landing.tsx`, images in `public/posture/`). It never quotes a price — figures come from RevenueCat through `ProductPurchase` — and it renders the lineup from `lib/products.ts` rather than restating it, so the sales copy and the delivered videos can't drift apart.
  - **Free-membership signup** — a hidden, unlisted page (`/join/[code]`, gated by the `JOIN_SECRET_SLUG` env var) where a user signs up via Clerk and is granted a **lifetime "Move Mindful Pro" promotional entitlement** server-side through RevenueCat's REST API (`REVENUECAT_SECRET_API_KEY`), then lands on `/home`. Reuses the existing entitlement gate unchanged. Protected by URL obscurity only — anyone with the link can self-enroll.
  - **Mailchimp audience sync** — two webhook receivers keep the marketing audience in step with who someone is. Clerk's (`/api/webhooks/clerk`, Svix-signature verified) adds new users on `user.created` with `signup` and, when they signed up from a product's page, `source:<slug>` — a stronger signal than it looks, since the only thing that sends a signed-out visitor to sign-up is a buy button. RevenueCat's (`/api/webhooks/revenuecat`, shared-secret via `REVENUECAT_WEBHOOK_AUTH`) **reconciles rather than records**: on any event it asks RevenueCat what the customer holds now and sets every `purchased:<slug>` tag (plus `member`) to match, so refunds, expiries, transfers and dashboard revocations all work without enumerating event types, and retries or replays converge instead of corrupting. Emails come from Clerk, not RevenueCat's `$email` attribute, which is only set on gated content and so is routinely absent for a first-time buyer. The full tag vocabulary lives in `lib/audience-tags.ts`. Both receivers must be listed in `proxy.ts` — anything a machine calls is otherwise redirected to `/sign-in`, which a sender reports as a delivery failure rather than an auth error.
  - **Admin CMS** (`/admin`, admin-only) — **classes**: Upload page (batch direct-upload many video files straight to Mux via signed upload URLs + `@mux/upchunk`, with per-file progress and a small concurrency cap; uploaded assets surface in Import once Mux finishes encoding), Import page (list Mux assets → import or **Trim & import** to clip dead air into a new Mux asset, or delete unwanted assets straight from the list; live recordings stay visible but import/trim/delete wait until Mux finalizes the recording duration), create/edit (full video player on the edit page for review), request a temporary Mux master MP4 download for offline editing, publish/unpublish, delete from overview rows or the edit page (with optional Mux asset deletion), one-click "delete raw recording" on trimmed clips once the clip is ready, assign an instructor, set an admin display date (defaults to today on import/add, shown on cards + the play page), choose which collections the class belongs to right from the create/edit/trim form (the auto-add collection comes pre-selected and can be unchecked per class); class title edits sync back to the Mux asset's `meta.title` so videos are searchable in the Mux dashboard; **instructors**: teachers with an uploaded profile photo (client-side square-cropped, stored in Supabase Storage), one assigned per class; **tags**: tag groups + tags (create/rename/delete, cascade-safe); **collections**: manual (hand-picked + drag-to-reorder member order, via `@dnd-kit`) and smart (tag-rule membership, auto-resolved, with the same drag-to-reorder ordering and "sort by date" layered on top as an overlay — newly-tagged classes appear at the top automatically), publish, drag-to-reorder row ordering, a per-collection display limit, and an "auto-add new classes to the top" toggle (manual) that pre-selects the collection in the class form so new classes land on it by default (uncheckable per class). All writes go through server actions using the Supabase service-role key (`server-only`).
  - **Member browse** (`/classes`) — curated **collection carousels** (manual + smart, ordered, each capped at its display limit); class card/detail metadata derived from tags (Discipline label · Intensity badge · Focus/Vibe chips) plus the admin class date (on cards and the play page), with the instructor's avatar + name (single-initial fallback) on cards and the class page. Curation-only: a class appears only if it's in a published collection.
  - **Live** (`/live`) — a persistent full-width Mux live stream (`streamType="live"`, playback ID via `NEXT_PUBLIC_MUX_LIVESTREAM_PLAYBACK_ID`) that polls a protected `/api/live/status` route for Mux's active-stream state, starts muted playback automatically when the configured stream becomes live, shows a viewer-local "next class" countdown banner (Luxon), and renders a hardcoded recurring weekly schedule as a month calendar (class times defined in Arizona time, converted to the viewer's local timezone, prev/next month nav).
  - **Home** (`/home`) — the signed-in root (distinct from `/`, the public marketing page).
    Every entry point lands here: the homepage redirect, the `/join` grant, the PWA
    `start_url`, and Clerk's `AFTER_SIGN_IN_URL`. Lists every product with an owned/locked
    badge, linking through to the video library or the sales page. The class library joins
    it when the membership returns.
  - **Account Settings** (`/account`) — plan status and profile.
  - **Help** (`/help`) — contact page (email link).
  - **Two-tier route groups** — `(app)` is the signed-in shell (header + user menu),
    requiring an account but **no** entitlement, so free signups and one-time-product
    buyers can reach `/home`, `/account` and `/help`. `(app)/(member)` nests inside it and
    adds the `EntitlementGate` for the membership-only routes (`/classes`, `/live`),
    inheriting the header rather than duplicating it.
  - **Custom user menu** — Clerk user info synced to RevenueCat.
  - **Installable web app (PWA)** — a web manifest (`src/app/manifest.ts`) plus `appleWebApp` metadata make the site installable to the iOS/Android home screen as a standalone app. `display: "standalone"` launches it chrome-less to `MEMBER_HOME`, and `scope: "/"` keeps same-origin navigation inside the standalone window (so taps on nav links don't open in an iOS in-app browser overlay). The proxy matcher already leaves `/manifest.webmanifest` public.
  - **Supabase database** — `user_profiles`, `classes`, `instructors`, `tags`, `tag_groups`, `class_tags`, `collections`, `collection_classes`, `collection_rule_tags`, all with RLS (read-only for members; admin writes via service-role). Instructor avatars live in a public `instructor-avatars` Storage bucket.
  - **Deployed to Vercel** — live at `www.movemindful.com`. Auto-deploys on push to `main`.
- `apps/mobile` — Expo 56 / React Native app (starter screen, no integrations yet)
- Shared `tsconfig.base.json` for consistent TypeScript settings across packages

What's not yet built:
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
│   │   ├── src/components/# Mux player, user menu, entitlement gate, carousel, products/*, admin/*
│   │   └── src/app/       # App Router
│   │       ├── page.tsx        # Public landing (redirects signed-in → /home)
│   │       ├── pricing/        # Pricing page (RevenueCat offerings + purchase)
│   │       ├── sign-in/        # Clerk <SignIn />
│   │       ├── sign-up/        # Clerk <SignUp />
│   │       ├── join/[code]/    # Hidden free-membership signup (env-gated, lifetime grant)
│   │       ├── actions/        # Server actions (classes, tags, collections)
│   │       ├── admin/          # Admin CMS: classes (upload, import, trim, edit), tags, collections
│   │       ├── (app)/          # Signed-in shell (no entitlement): home, account, help
│   │       ├── (app)/[product]/# One-time products: public sales page + gated player
│   │       └── (app)/(member)/ # Membership-gated: classes (carousels), classes/[id], live
│   └── mobile/            # Expo 56 / React Native
│       └── App.tsx        # Entry point
├── packages/
│   └── core/              # Shared TypeScript
│       └── src/
│           ├── types.ts   # User, VideoClass, Tag, TagGroup, Collection, Challenge, …
│           ├── access.ts  # hasAccess, isChallengeExpiringSoon, shouldShowUpsell
│           └── index.ts   # Re-exports
├── supabase/migrations/   # SQL migrations (001 schema, 002 media org, 003 cleanup, 004 instructors, 005 collection auto-add + limit, 006 clip source tracking, 007 class date)
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

The web app needs Clerk, Supabase, RevenueCat, Mux and Mailchimp keys, plus `REVENUECAT_WEBHOOK_AUTH` (a random shared secret, set identically in RevenueCat's webhook Authorization field). Copy the template and fill in your values:

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
