# Move Mindful

A video fitness platform with on-demand classes, livestreaming, push notifications, and community features. Web and iOS are co-equal platforms — the web is the storefront (where purchases happen), the iOS app is the logged-in experience.

## Current Status

**Phase 3 complete — Mux video classes, RevenueCat payments, and entitlement gating all live.** (See the full build order with checkmarks in [plan.md](./plan.md).)

What's in place:

- Turborepo monorepo with npm workspaces
- `packages/core` — shared TypeScript types (`User`, `VideoClass`, `Challenge`, `UserAccess`, etc.) and access-control helpers (`hasAccess()`, `isChallengeExpiringSoon()`, `shouldShowUpsell()`). Consumed as source by web and mobile (no separate build step)
- `apps/web` — Next.js 16 app with Tailwind CSS v4
  - **Clerk authentication** — sign-in/sign-up pages, `ClerkProvider`, and route protection via `proxy.ts` middleware. Public routes: `/`, `/pricing`, `/sign-in`, `/sign-up`. Protected routes (e.g. `/classes`, `/dashboard`) redirect signed-out users to sign-in. Signed-in users on `/` redirect to `/classes`.
  - **Mux video player** — class catalog with responsive grid, Mux-generated thumbnails, and individual class pages with `@mux/mux-player-react` for adaptive streaming and AirPlay.
  - **RevenueCat + Stripe payments** — pricing page fetches real offerings from RevenueCat, purchase flow via Web Billing SDK (Stripe-powered). "Move Mindful Pro" entitlement gates access to all member routes.
  - **Subscription dashboard** — plan status, renewal/expiry date, manage subscription link (RevenueCat hosted management page).
  - **Custom user menu** — profile photo from Clerk, manage subscription, profile (opens Clerk settings), sign out. Clerk user info (name, email) synced to RevenueCat.
  - **Supabase database** — `user_profiles` and `classes` tables with RLS enabled.
  - **Deployed to Vercel** — live at `www.movemindful.com`. Auto-deploys on push to `main`.
- `apps/mobile` — Expo 56 / React Native app (starter screen, no integrations yet)
- Shared `tsconfig.base.json` for consistent TypeScript settings across packages

What's not yet built:
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
│   │   ├── src/proxy.ts   # Clerk middleware (route protection)
│   │   ├── src/lib/       # Supabase + RevenueCat client helpers
│   │   ├── src/components/# Mux player, user menu, entitlement gate, etc.
│   │   └── src/app/       # App Router
│   │       ├── page.tsx        # Public landing (redirects signed-in → /classes)
│   │       ├── pricing/        # Pricing page (RevenueCat offerings + purchase)
│   │       ├── sign-in/        # Clerk <SignIn />
│   │       ├── sign-up/        # Clerk <SignUp />
│   │       └── (member)/       # Protected: classes, classes/[id], dashboard
│   └── mobile/            # Expo 56 / React Native
│       └── App.tsx        # Entry point
├── packages/
│   └── core/              # Shared TypeScript
│       └── src/
│           ├── types.ts   # User, VideoClass, Challenge, UserAccess, etc.
│           ├── access.ts  # hasAccess, isChallengeExpiringSoon, shouldShowUpsell
│           └── index.ts   # Re-exports
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
