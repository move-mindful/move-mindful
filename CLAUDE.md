# Move Mindful

A video fitness platform with on-demand classes, livestreaming, push notifications, and group chat. Web and iOS are co-equal platforms.

## Project Plan

See [plan.md](./plan.md) for the full architecture, tech stack, build order, security guidelines, and cost breakdown.

## README

See [README.md](./README.md) for project overview, current status, setup instructions, and project structure. **Keep the README up to date** — when new features are added, integrations are wired up, or the project structure changes, update the README to reflect the current state.

## Tech Stack

- **Language:** TypeScript (web, mobile, backend)
- **Web:** React + Next.js (hosted on Vercel)
- **Mobile:** React Native via Expo
- **Monorepo:** Turborepo
- **Auth:** Clerk
- **Payments:** RevenueCat (Stripe on web)
- **Video:** Mux
- **Database:** Supabase
- **Push Notifications:** Expo Notifications

## Project Structure

```
/packages/core       ← Shared TypeScript: types, API client, business logic
/apps/web            ← React + Next.js (website + purchase flows)
/apps/mobile         ← React Native / Expo (iOS app)
```

## Local Development

- **Claude Preview (`preview_*` tools) does not work reliably in this environment — don't use it to verify changes.** Navigation/snapshots tend to hang or fail. Verify another way (read the code, run the relevant build/typecheck/tests, or ask the user to check in their own browser).

## Key Principles

- All purchases happen on the web (no in-app purchases at launch)
- Derive user ID from Clerk session, never from URL or request body
- Clerk auth middleware on every protected API route
- No secret keys in `NEXT_PUBLIC_` env vars
- Supabase RLS enabled on all tables
- Verify Stripe webhooks with `constructEvent()`
