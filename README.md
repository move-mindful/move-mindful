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
  - **Admin CMS** (`/admin`, admin-only) — **classes**: Sync from Mux (list assets → import), create/edit, publish/unpublish, delete (with optional Mux asset deletion); **tags**: tag groups + tags (create/rename/delete, cascade-safe); **collections**: manual (hand-picked + up/down order) and smart (tag-rule, auto-resolved), publish, row ordering. All writes go through server actions using the Supabase service-role key (`server-only`).
  - **Member browse** (`/classes`) — curated **collection carousels** (manual + smart, ordered); class card/detail metadata derived from tags (Discipline label · Intensity badge · Focus/Vibe chips). Curation-only: a class appears only if it's in a published collection.
  - **Account Settings** (`/account`) — plan status and profile.
  - **Custom user menu** — Clerk user info synced to RevenueCat.
  - **Supabase database** — `user_profiles`, `classes`, `tags`, `tag_groups`, `class_tags`, `collections`, `collection_classes`, `collection_rule_tags`, all with RLS (read-only for members; admin writes via service-role).
  - **Deployed to Vercel** — live at `www.movemindful.com`. Auto-deploys on push to `main`.
- `apps/mobile` — Expo 56 / React Native app (starter screen, no integrations yet)
- Shared `tsconfig.base.json` for consistent TypeScript settings across packages

What's not yet built:
- In-browser Mux direct upload (admins upload in the Mux dashboard, then Sync) and Mux livestream recording import (deferred to Phase 7)
- 30-day challenge expiry tracking and upsell flow
- iOS app (Expo + React Native)
- Push notifications
- Group chat and livestreaming (deferred to later phases per plan)

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
├── supabase/migrations/   # SQL migrations (001 schema, 002 media org, 003 cleanup)
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
