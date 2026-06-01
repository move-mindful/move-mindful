# Move Mindful

A video fitness platform with on-demand classes, livestreaming, push notifications, and community features. Web and iOS are co-equal platforms — the web is the storefront (where purchases happen), the iOS app is the logged-in experience.

## Current Status

**Monorepo scaffolding complete — integrations not yet wired up.** (Phase 1 per [plan.md](./plan.md) is in progress: Clerk auth and Supabase DB are next.)

What's in place:

- Turborepo monorepo with npm workspaces
- `packages/core` — shared TypeScript types (`User`, `VideoClass`, `Challenge`, `UserAccess`, etc.) and access-control helpers (`hasAccess()`, `isChallengeExpiringSoon()`, `shouldShowUpsell()`). Consumed as source by web and mobile (no separate build step)
- `apps/web` — Next.js 16 app with Tailwind CSS v4 (branded landing page, no Clerk/Mux/Stripe yet)
- `apps/mobile` — Expo 56 / React Native app (starter screen, no integrations yet)
- Root-level `index.html` placeholder/landing page
- Shared `tsconfig.base.json` for consistent TypeScript settings across packages

What's not yet built:

- Clerk authentication
- Supabase database and RLS policies
- RevenueCat / Stripe payment integration
- Mux video player and class catalog
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
│   │   └── src/app/       # App Router (layout.tsx, page.tsx)
│   └── mobile/            # Expo 56 / React Native
│       └── App.tsx        # Entry point
├── packages/
│   └── core/              # Shared TypeScript
│       └── src/
│           ├── types.ts   # User, VideoClass, Challenge, UserAccess, etc.
│           ├── access.ts  # hasAccess, isChallengeExpiringSoon, shouldShowUpsell
│           └── index.ts   # Re-exports
├── index.html             # Static placeholder landing page
├── plan.md                # Full architecture, build order, security guidelines
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
