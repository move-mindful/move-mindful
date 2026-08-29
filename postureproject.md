# Posture Project

Working notes for the pivot to one-off product sales. Companion to
[plan.md](./plan.md) (the original architecture) and [README.md](./README.md)
(current state of the whole app).

---

## What we're doing

The class library and live streaming are **paused**. The next thing to sell is
**Posture** — a one-time, lifetime purchase of five short videos. More one-off
products will follow, sold individually.

The class library and live classes come back later under the **recurring
membership**. The two must stay isolated, which is why access is modelled as
one RevenueCat entitlement per sellable thing rather than a single paywall.

---

## Done

### Class library + live put on hold
- Hidden from the member nav; admins keep the links to preview.
- `/classes`, `/classes/[id]`, `/live` gated by `requireSectionUnlocked()`
  (`lib/auth/locked-sections.ts`) — server-side, so nothing renders for
  non-admins — plus an optimistic redirect in `proxy.ts`.
- To release: delete the three `requireSectionUnlocked()` calls and the
  `admin &&` in `app/(app)/layout.tsx`.

### Route restructure
Split the one entitlement-gated group into two, nested so the header isn't duplicated:

```
(app)/            ← signed-in, NO entitlement: home, account, help, /[product]
  (member)/       ← adds EntitlementGate (membership): classes, live
```

Previously `/account` and `/help` sat behind the membership gate, which would
have locked a Posture buyer out of their own account page.

### `/home`
The signed-in root — distinct from `/`, the public marketing page. Every entry
point lands here (homepage redirect, `/join` grant, PWA `start_url`, Clerk
`AFTER_SIGN_IN_URL`), all via `MEMBER_HOME` in `lib/routes.ts`. Lists products
with Yours/Locked badges.

### Access model
- **One entitlement per sellable thing.** Membership = `Move Mindful Pro`;
  Posture = `posture`.
- Migration `008_class_access.sql` adds `classes.required_entitlement`
  (null = free). **Applied in production.** Defaults to the membership so it
  fails safe: existing rows backfill to members-only, and new imports are
  locked until deliberately marked free.
- Lives on the *class*, not the collection — a class can sit in several
  collections and `collections.auto_add_new` files new imports into one
  automatically, so collection-derived access would have made a paid video free
  the moment it landed in a free browse row.
- Admin **Access** picker on the class form, a dropdown over
  `ENTITLEMENT_OPTIONS` (never free text — a typo'd identifier makes a class
  unreachable or free with nothing in the UI to show it).

### Server-side entitlement reads
`getActiveEntitlements()` (`lib/revenuecat-admin.ts`) reads live entitlements
from RevenueCat's REST API; `getViewerAccess()` / `viewerCanAccess()`
(`lib/auth/viewer.ts`) combine that with Clerk and an admin bypass.

Verified against RevenueCat's docs, because each of these is a real bug:
- `expires_date: null` means **lifetime** — what `/join` and the one-time
  products issue. Must count as active.
- `grace_period_expires_date` keeps a customer entitled through a failed-card
  retry.
- Fails **closed** (an outage denies rather than grants), cached per render,
  skipped entirely for admins.

### Product pages
`lib/products.ts` is the single definition. Adding a product = one array entry;
the page, routing, public-URL handling, access check and `/home` card all follow.

- `/<product>` — the sales page, **public** (it's the URL you advertise).
  Shows videos to buyers, the pitch to everyone else.
- `/<product>/<video>` — the player, behind sign-in. The entitlement check runs
  **before render** and redirects on failure, so playback ids never reach an
  unentitled browser.
- `ENTITLEMENT_OPTIONS` derives its product rows from `PRODUCTS`.

### Housekeeping
- `/pricing` no longer advertises a 30-day challenge and monthly membership,
  neither of which is for sale.
- `CLAUDE.md` push guidance corrected: the remote is now SSH via a pinned host
  alias, so `git push` needs no `gh` account check (only `gh` CLI commands do).
- Vercel `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` → `/home`.
- RevenueCat: `posture` entitlement and product created, packaged as
  `PostureReset` in the MoveMindful offering.
- Vercel `AFTER_SIGN_UP_URL` → `/home`.
- `npm run lint` passes clean: `schedule-calendar.tsx` set state in an effect to
  defer the current month past hydration; replaced with `useSyncExternalStore`
  and a derived month.

---

### Selling
- `/<product>` shows the package's **real price** and checks out that product
  directly, found across all offerings by product **or** package identifier.
  Falls back to a `/pricing` link if no package matches, and logs a `[product]`
  console warning naming every offering and package it can see — a silent
  fallback is indistinguishable from working otherwise.
- The Posture Reset package is in the MoveMindful offering; Challenge and
  Monthly have been removed, so `/pricing` now lists only what's on sale.
- Public sign-up is back on the homepage (Get Started / Sign In).

### The sign-up redirect fork — resolved
Both `AFTER_SIGN_IN_URL` and `AFTER_SIGN_UP_URL` point at `/home`. Flows needing
somewhere specific pass `?redirect_url=<relative path>` to `/sign-up` instead:
`/pricing` resumes checkout, product pages return to their own slug. The
sign-up page honours **same-origin relative paths only** — `redirect_url` is
attacker-controllable, so anything else would make it an open redirect.

## To do — to launch Posture

> **Correction.** An earlier version of this file claimed the site ran on a
> RevenueCat *sandbox* key. That was wrong. The check that produced it grepped
> the deployed bundle for `rcb_` and took the first match — which was
> `rcb_sb_`, a constant the purchases-js SDK itself ships to *detect* sandbox
> keys, not the configured key. The real key is a plain `rcb_` production key,
> in Vercel and in `.env.local` alike.

**Purchases are real, in every environment.** Both Vercel and local
`.env.local` hold the production Web Billing key, so a test purchase — on
movemindful.com or on localhost — is a live Stripe charge that needs refunding.

To test for free, put the **sandbox** key (`rcb_sb_…`, from RevenueCat → Apps &
Providers → Configurations → the web configuration) in `.env.local` and test
against `npm run dev:web`. Leave Vercel on the production key.

1. **Upload the five videos** to Mux, then paste them into `lib/products.ts`:
   `{ slug, title, playbackId, durationMinutes }`. This is the last content
   blocker — everything else is wired and waiting.

2. **Test the purchase end-to-end, on the sandbox key, as a non-admin.**
   Admins bypass content gates by design, so buying as yourself proves the
   checkout but not the paywall. Make a second Clerk user without
   `role: admin`: buy, confirm the entitlement lands, `/posture` flips from the
   pitch to the video list, and `/home` shows **Yours**. This same account is
   the only way to verify the Classes/Live lock actually holds.

3. **Write real copy** for the Posture Reset tagline (currently placeholder) and
   `/pricing` (currently a bare "Get access" heading).

4. **Restore the homepage Pricing link** if wanted — it's still commented out
   from when `/pricing` listed parked products. That's no longer true, so it can
   come back, though a direct link to `/posture` may serve better while there's
   one product.

## Flagged, not yet addressed

### Mux videos are public — accepted for now
Every asset is created with `playback_policies: ["public"]`
(`app/actions/uploads.ts`, `app/actions/classes.ts`). A public playback id
streams to anyone holding it, with no auth, forever. Gating the *page* does not
gate the *video* — a buyer can extract ids from page source and share URLs.

Mitigated only by keeping ids off the wire for unentitled viewers, which the
product pages do. **Decision: acceptable at launch.** The real fix is Mux
**signed playback** (signed policy + short-lived JWTs minted server-side) —
revisit when the revenue justifies it, or if sharing shows up.

### The membership gate is still client-side
`EntitlementGate` is a client component wrapping server-rendered children, so
Next streams those children — playback ids included — and the gate only hides
what already reached the browser. A UX gate, not a boundary.

Currently harmless because `/classes` and `/live` are admin-locked. **Must be
fixed before the membership launches** — port them to `getViewerAccess()` /
`viewerCanAccess()`, the way the product pages already work.

### Other `NEXT_PUBLIC_` vars saved as Secret
Clerk publishable key, Supabase URL + publishable key, RevenueCat API key, Mux
playback id. **Nothing is broken** — builds read secrets fine — and none is
genuinely secret. But you can't read any of them back. Tidy up when convenient.

The genuinely secret ones (`CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`REVENUECAT_SECRET_API_KEY`, `MUX_TOKEN_SECRET`, `JOIN_SECRET_SLUG`) should stay
Secret.

### Free top-of-funnel products need no RevenueCat entitlement
Deliberate decision. A Clerk account is what puts someone "in the system"; an
entitlement granted to everyone carries no information and adds a failure mode
at the worst moment (see the `/join` 404 bug, commit `5872b46`). Free content
lives in the `(app)` group — sign-in only.

Revisit **only** if a free product shouldn't go to everyone (limited-time,
partner promo, revocable). Then it earns an entitlement.

### Does the membership include the products?
Undecided, and deliberately not a code question. If yes, attach the membership
product to the `posture` entitlement in RevenueCat — no deploy, reversible.

### `packages/core` is stale
`UserAccess`, `hasAccess()`, `shouldShowUpsell()`, `Challenge` all model the old
membership + 30-day-challenge world. **Nothing imports `@move-mindful/core`.**
Rewrite rather than delete — it's the natural home for a shared access model
once the iOS app arrives.
