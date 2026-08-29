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

## Key Principles

- All purchases happen on the web (no in-app purchases at launch)
- Derive user ID from Clerk session, never from URL or request body
- Clerk auth middleware on every protected API route
- No secret keys in `NEXT_PUBLIC_` env vars
- Supabase RLS enabled on all tables
- Verify Stripe webhooks with `constructEvent()`
