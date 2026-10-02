# Move Mindful

A video fitness platform with on-demand classes, exercise-by-exercise workouts, livestreaming, push notifications, and group chat. Web and iOS are co-equal platforms.

## Docs

- [README.md](./README.md) — project overview, current status, setup instructions, and project structure. **Keep the README up to date** — when new features are added, integrations are wired up, or the project structure changes, update the README to reflect the current state.
- [plan.md](./plan.md) — the full architecture, tech stack, build order, security guidelines, and cost breakdown. Tick build-order items off as they ship.
- [postureproject.md](./postureproject.md) — the pivot to one-time products: decisions, launch to-dos, flagged risks.
- [manychat.md](./manychat.md) — the ManyChat integration and DM flow design.
- `design/*/README.md` — how each design canvas mirror relates to the live page, and how to edit a canvas.
- [phase-4-plan.md](./phase-4-plan.md) — historical record of the Phase 4 plan; don't treat it as current.

`AGENTS.md` is a symlink to this file, for tools that read that name — edit this one.

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
- **AI:** Claude API (`@anthropic-ai/sdk`) — admin-only "Generate with AI" in the workout builder

## Project Structure

```
/packages/core        ← Shared TypeScript: the workout model, player state machine and saved progress (tested); the original access model (unused)
/apps/web             ← Next.js 16: website, purchase flows, admin CMS, workout player
/apps/mobile          ← React Native / Expo (iOS app — starter screen only)
/supabase/migrations  ← Numbered SQL migrations
```

## Local Development

- **The built-in browser pane opens the live site fine** — e.g. `https://www.movemindful.com/demo1`, which is public (it worked 2026-10-01). The owner has signed in there, so signed-in pages (`/workouts`, `/admin`) may work too; that session is theirs — never sign out or change account settings. The pane is mostly for the owner's own use: use it when a check genuinely needs it, not by default, and remember the live site only has what's been pushed and deployed. It's a desktop engine, so it can't stand in for iPhone Safari (audio sessions, status bar, autoplay).
- **Local dev-server previews (`preview_start` with a launch config) have been unreliable here** — navigation and snapshots tended to hang or fail. Verify local changes another way (read the code, run the relevant build/typecheck/tests, or ask the user to check in their own browser).
- **`apps/web` runs Next.js 16, which has breaking changes from older versions.** Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (see `apps/web/AGENTS.md`); likewise the versioned Expo docs for `apps/mobile`.
- **Checks:** `npm test -w @move-mindful/core` (unit tests), `npx tsc --noEmit -p apps/web` (typecheck), `npm run lint`, and a production build (`npx next build` in `apps/web`) for changes to routing, server actions or data loading.

## Database

- Migrations are numbered SQL files in `supabase/migrations/`. **The owner applies them by hand in the Supabase SQL Editor — never run SQL against the live database.** Write the migration, say it needs applying, and make the code cope until it has run (reads come back empty rather than crashing).
- Server code uses the service-role client (`lib/supabase/admin.ts`) after checking who the viewer is; the browser never writes to the database.

## Git / GitHub accounts

- **Remote:** `git@github-move-mindful:move-mindful/move-mindful.git` — an SSH host
  alias defined in `~/.ssh/config`, pointing at github.com with a dedicated key
  (`IdentityFile ~/.ssh/id_ed25519_github_move_mindful`).
- **`git push` needs no account check.** The alias pins the key, so pushes always
  authenticate as `move-mindful` (verify with `ssh -T git@github-move-mindful`)
  regardless of which account the `gh` CLI has active. Just push.
- **The `gh` CLI is a different story.** The user keeps two accounts logged in
  (`move-mindful` and `maxwellgustav`) and switches the active one while working
  across projects. `gh` commands — PRs, issues, API calls — use the *active*
  account, and `maxwellgustav` is not a collaborator on this repo. So if a `gh`
  command fails with `403 Permission ... denied to maxwellgustav`, that's why:
  `gh auth switch -u move-mindful`. This does not apply to `git push`.
- Neither affects the commit author, which is `Maxwell Gustaitis
  <contact@movemindful.com>` either way.

## Pushing

The owner's call (2026-10-01), and an exception to the global "never push unless I explicitly ask" — for this repo only:

- **Push changes yourself once typecheck and lint pass**, without waiting for "push". Say in the reply that it's pushed.
- **Major changes still wait for the owner to say "push":** a new feature, a big rework, a migration, a dependency change, or anything touching payments, sign-in or members' data. When unsure whether a change is major, ask.

## Key Principles

- All purchases happen on the web (no in-app purchases at launch)
- Derive user ID from Clerk session, never from URL or request body
- Clerk auth on every protected route — and inside every server action, since actions are reachable by direct POST
- No secret keys in `NEXT_PUBLIC_` env vars
- Supabase RLS enabled on all tables; member-owned tables (`member_preferences`, `workout_sessions`, `workout_ratings`) and admin settings (`app_settings`) have no policies and are only read and written on the server
- Gate paid content on the server before rendering (`getViewerAccess()` / `viewerCanAccess()`), so Mux playback ids never reach a browser that isn't entitled to them
- Verify every webhook's sender before trusting it: Clerk by its Svix signature, RevenueCat by its shared secret — and Stripe with `constructEvent()` if its webhooks are ever consumed directly
- A new table keyed by a Clerk user id must be cleared in `deleteMemberData()` (`lib/member/delete-server.ts`), so deleting an account deletes its data
- Every AI feature follows README → "Building AI features": prompt caching on the stable start of each request (system prompt and repeated context marked with `cache_control`, the changing request last), token use logged per request, Claude called only server-side behind auth, and structured answers re-validated on the server
