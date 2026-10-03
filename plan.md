# Move Mindful — Project Plan

## Overview

A video fitness platform offering on-demand classes, exercise-by-exercise workouts, live streaming, group chat, and push notifications. Web and iOS are co-equal platforms. All purchases happen on the web; the iOS app is the logged-in experience — though as of Oct 2026 the leaning is for the app to sell through Apple at launch (see Purchasing & Platform Strategy).

**Where things stand (Sep 2026):** the web app is live at `www.movemindful.com`. What's for sale is a one-time product, `Posture & Mobility Reset`, plus a free lead-magnet routine; the class library, live stream and workouts are built but locked to admins until the membership (and a decision on how workouts are sold) arrives. See [README.md](./README.md) for the current state and [postureproject.md](./postureproject.md) for the pivot.

---

## Tech Stack

| Layer              | Tool                          | Purpose                                      |
|--------------------|-------------------------------|----------------------------------------------|
| Language           | TypeScript                    | Shared across web, mobile, and backend       |
| Web                | React + Next.js               | Website, marketing, purchase flows           |
| Mobile             | React Native via Expo         | iOS app                                      |
| Monorepo           | Turborepo                     | Manages shared code across web and mobile    |
| Auth               | Clerk                         | User accounts, login, profiles               |
| Payments/Subs      | RevenueCat                     | Subscriptions, one-time purchases, member management, analytics |
| Payment Processing | Stripe (via RevenueCat)        | Web payment processing                       |
| Video              | Mux                           | On-demand classes + livestreaming (later)    |
| Chat               | Stream Chat (not at launch)   | Group chat, Ladder-style design (see below)  |
| Push Notifications | Expo Notifications            | iOS push notifications                       |
| Web Hosting        | Vercel                        | Next.js hosting, serverless functions, CDN   |
| Backend / DB       | Supabase                      | Postgres, auth helpers, storage, realtime    |
| AI                 | Claude API (Anthropic)        | Admin: "Generate with AI" in the workout builder |
| App Store          | Apple Developer Program       | Required to publish iOS app ($99/year)       |

---

## Monorepo Structure

```
/packages/core       ← Shared TypeScript: types, API client, business logic, SDK setup
/apps/web            ← React + Next.js (website + purchase flows)
/apps/mobile         ← React Native / Expo (iOS app)
```

---

## Business Model

### What's on sale now (Sep 2026)
- **One-time products** — short video series sold outright with lifetime access, one RevenueCat entitlement each. The first is `Posture & Mobility Reset` (`/posture`, five classes, entitlement `posture`). Defined in `apps/web/src/lib/products.ts`.
- **Free lead magnet** — the `12 Minute Posture and Mobility Routine`, free with any account (no entitlement), advertised at `/class1`. Signups feed Mailchimp and ManyChat.
- **Paused** — the recurring membership (`Move Mindful Pro`: class library + live) and the 30-day challenge below. Whether the membership will include the one-time products is undecided (a RevenueCat dashboard change either way, not code).

The sections below are the original plan and still describe where the membership is headed.

### 30-Day Challenge (Entry Product — original plan, not currently for sale)
- One-time purchase managed through RevenueCat (Stripe on web)
- Time-limited access (30 days from purchase)
- Goal: low-commitment entry point to acquire users

### Membership (Recurring)
- Monthly subscription via RevenueCat (Stripe on web; Apple in the app if the app becomes the storefront)
- Full access to all classes, live streams, chat, community

### Upsell Flow
1. User buys the 30-day challenge on the website
2. Around day 25, show upsell prompts ("Keep going with a membership!")
3. Day 30: challenge locks, membership CTA displayed
4. Optional: offer a discount coupon for challenge completers

### Why RevenueCat for Payments
- **Unified entitlement system** — one API to check "does this user have access?" across web and mobile, regardless of where they purchased
- **Subscriber management dashboard** — view, search, and manage individual subscribers without building admin tools
- **Cohort analytics** — track conversion rates, churn, LTV, trial-to-paid, challenge-to-membership
- **Experiments** — A/B test pricing, trial lengths, and offers without code changes
- **Cross-platform ready** — if Apple IAP is added later, RevenueCat unifies Stripe + Apple under one system automatically
- **Stripe integration** — RevenueCat uses Stripe for web purchases, so payment processing is still best-in-class

---

## Purchasing & Platform Strategy

### Leaning: the app becomes the storefront (Oct 2026 — not final)
Leaning toward **selling through Apple inside the iOS app, and eventually only there** — the Ladder model (a web quiz → the App Store; a 7-day trial with no card; subscriptions through Apple). The web-storefront sections below stay in force until the switch.

- **Why:** simplest to run. Apple's cut — 15% under the App Store Small Business Program — is all-in: card processing, sales tax / VAT, refunds, failed payments and billing support. The web keeps roughly 10–12% more of each payment (Stripe 2.9% + 30¢), but Move Mindful is then the seller: tax registration and filing (UK/EU VAT from the first sale), international-card surcharges, chargebacks, billing support. And an app that unlocks web purchases without also offering them through Apple risks rejection — Guideline 3.1.3(b) allows that only "provided those items are also available as in-app purchases within the app", and the US link-out change made no exception to that sentence.
- **RevenueCat stays.** It matches Apple purchases to the Clerk user (the app logs in to RevenueCat with the Clerk id before buying), answers `getViewerAccess()` the same way whichever store charged, fires the same webhook (Mailchimp / ManyChat tags unchanged), and keeps Android or web sales open for later. Free under $2,500/mo tracked revenue, then 1%.
- **The path — nothing switches off early:**
  1. Until the app launches, the website keeps selling as today.
  2. Build the app with Apple payments — the same work either way (Phase 5).
  3. At launch both sell, so for a while it's effectively the hybrid.
  4. Once the app's sales are proven, the product pages change from "Buy" to "Get the app". Reversible.
- **Trial:** no card — the server grants 7 days of access at sign-up (the `/join` grant with an end date), then the app shows the Apple paywall. See "Free trial" under Future Considerations.
- **Settles:** sign-ups in the app, so account deletion in the app too (see iOS App Sign-in); enroll in the Small Business Program.
- **Existing buyers:** one-time purchases are lifetime and stay. The membership is paused, so there are few or no web subscriptions to carry; any that exist stay on Web Billing until cancelled.
- **Members billed by Apple:** the website's account page says "Billed through Apple — manage it on your iPhone" (Apple subscriptions can only be cancelled in iPhone Settings), and the paywall is hidden from anyone who already has access, so nobody pays twice.
- **Still open:**
  - **One-time products in the app** — the Posture Reset as an Apple one-time purchase, or folded into the reopened membership so the app sells only a subscription (ties to the open "does the membership include the one-time products?" question above).
  - **Where Instagram DM traffic signs up** — leaning: a web page (the free class or a quiz) → Clerk sign-up on the web → "Download the app and sign in", which keeps the ManyChat contact-id cookie and the Mailchimp tags working. Sending people straight to the App Store loses the ManyChat link.
  - **Who'd be left out** — laptop-only and Android visitors couldn't buy. Check roughly what share of Posture Reset buyers came from a computer before switching the website off.
- **Later, optional:** the US "pay on the web" button (see Future Considerations).

### Web = Storefront
- All purchases (challenge + membership) happen on the website
- RevenueCat manages subscriptions and one-time purchases (Stripe processes the payments)
- User never creates separate accounts — one Clerk login, RevenueCat customer linked via Clerk user ID

### iOS App = Experience (original plan — see the leaning above)
- No in-app purchases (avoids Apple's 15-30% cut)
- Users who open the app without a subscription see a "membership required" state
- **US — app-to-web checkout:** the in-app paywall can show a button that deep-links to the RevenueCat-hosted Web Billing checkout (Stripe underneath) and returns the user to the app with the "Move Mindful Pro" entitlement already unlocked. Enabled by the 2025 *Epic v. Apple* ruling — **no Apple commission, no scare screen**. One tap, no funnel drop-off; still only Stripe (~2.9% + 30¢) + RevenueCat fees. Identity is handed off so the purchase lands on the same `appUserID` (Clerk user ID) the app logs in with.
- **Outside the US (fallback):** Apple's anti-steering rules still apply — no clickable link to checkout. Show the generic "membership required" state and let marketing drive users to the website.
- **Caveats:** US-only. The Ninth Circuit largely upheld the ruling but said Apple may later charge a fee covering its genuine costs (amount not set), and Apple has taken it to the Supreme Court; the zero-commission rule stays in force meanwhile. Keep the no-link fallback so a rule change isn't a re-architecture. Apple's External Purchase Link disclosure rules + App Review still apply. **Verify current legal/App Review status before shipping.**
- Marketing (social media, email, search) still drives users to the website to purchase

### Access Control Logic
One RevenueCat entitlement per sellable thing — `Move Mindful Pro` for the membership, `posture` for the Posture Reset, and so on — so products and the membership stay independent. The web app checks them **on the server, before rendering**, so gated content (Mux playback ids included) never reaches a browser that isn't entitled to it:

```typescript
// apps/web — lib/auth/viewer.ts + lib/revenuecat-admin.ts
const viewer = await getViewerAccess()          // Clerk session + RevenueCat REST (cached per request)
if (!viewerCanAccess(viewer, product.entitlement)) redirect(salesPage)
// Admins pass every check (to preview); an entitlement with no expiry is lifetime;
// a RevenueCat outage denies access rather than granting it.
```

The iOS app gets gated content through the same server checks (see iOS App Sign-in below); `react-native-purchases`, identified by the same Clerk user id, drives its paywall and Apple purchases (or the app-to-web checkout, under the original plan).

### iOS App Sign-in (planned Oct 2026)
The app signs in to the **same Clerk accounts as the website** — one login, the same purchases, no second account system — and the server checks a request from the app exactly like one from a browser.

- **Sign-in screen:** Clerk's native `AuthView` from `@clerk/expo` (the old `@clerk/clerk-expo` is deprecated) — a SwiftUI screen, not a web page in a box, offering whichever methods are on in the Clerk dashboard. In beta since March 2026; the fallback is our own screens built on Clerk's hooks. Needs a development build, not Expo Go.
- **Methods:** email only, matching the website today. That means Sign in with Apple isn't required — Apple only requires it alongside a third-party login like Google (Guideline 4.8). If Google is ever added, add Sign in with Apple on web and app, and handle the "Hide My Email" catch: a web buyer who signs in with Apple and hides their email arrives with a relay address, so Clerk creates a new, empty account. The fix: the "membership required" screen shows the signed-in email with "Bought on the website? Sign in with the email you used there."
- **Staying signed in:** Clerk keeps the device's long-lived login in the iPhone's Keychain, so members stay signed in between launches.
- **Talking to our server:** the app gets a short-lived session token from Clerk (`getToken()` — 60 seconds, renewed automatically) and sends it as `Authorization: Bearer …` to the app's API routes (Phase 5). On the server, `auth()` reads that header the same way it reads the browser cookie, so `getViewerAccess()`, `requireAdmin()` and "user id from the session, never the request" carry over unchanged.
- **`proxy.ts`:** a signed-out request is redirected to `/sign-in` today — right for a browser, wrong for the app. The app's API routes answer a 401 JSON error instead.
- **Purchases:** the server stays the gate for content, so Mux playback ids never reach a phone that isn't entitled. `react-native-purchases` (identified by the Clerk user id) drives the paywall and Apple purchases.
- **Chat:** the app sends its Clerk token to the chat-token route; the server checks access and returns a Stream token for `stream-chat-expo` (see Group Chat). Signing out disconnects Stream, then Clerk.
- **Clerk dashboard (owner):** turn on the Native API, and register the iOS app (Apple Team ID + bundle ID).
- **App Review:** the app needs a login, so Review needs a demo account with access.
- **Sign-ups in the app — leaning yes** (with the app as storefront, above). Apple then requires account deletion in the app too (Guideline 5.1.1(v)). Deleting through Clerk fires the existing `user.deleted` webhook, so `deleteMemberData()` covers our tables; the subscription / Mailchimp / ManyChat question under "Across phases" still applies. Deleting an account doesn't cancel an Apple subscription, so the app tells people to cancel in iPhone Settings first.

---

## Feature Breakdown

### 1. On-Demand Video Classes
- Hosted on Mux (HLS adaptive streaming, automatic transcoding)
- `@mux/mux-player-react` on web — polished player with controls
- `expo-video` on mobile with Mux HLS URLs
- AirPlay works automatically on Apple devices (native `<video>` / iOS)
- Chromecast: future enhancement (requires Google Cast SDK integration)

### 1b. Exercise-by-exercise workouts
- Workouts assembled from short vertical exercise clips (tutorial + looping clip per exercise), played full screen with a story-style progress bar
- Admin builder for single exercises, rests, supersets and circuits, with an estimated time; exercise library with upload, edit, archive and tags
- Member player with tap and swipe controls, tutorial modes, auto-advance, settings saved to the account, and saved progress (Resume · N%)
- See Phase 4.5 in the build order below

### 2. Push Notifications
- Expo Notifications handles Apple APNs setup
- Use cases: new class alerts, challenge reminders, live stream starting

### 3. Livestreaming (Phase 2)
- Mux Live for one-to-many broadcast (instructor streams, members watch)
- If interactive/bidirectional needed later: evaluate LiveKit or Agora

### 4. Group Chat (Future — not at launch)
- Not included in initial build — add when community engagement becomes a priority

**Decision (2026-10-03): Stream Chat, with a Ladder-style design.**

- **Why Stream:** ready-made kits for React (`stream-chat-react`) and Expo (`stream-chat-expo`), so web and iOS get the same features without building chat twice. Threads, reactions, @mentions, pinned messages, image uploads, push, and flag/mute/block come built in — the last matters because App Store Guideline 1.2 requires filter, report and block for user-generated content. It also has a livestream channel type for Phase 7.
- **Cost:** free Build tier — 1,000 monthly active users, 100 concurrent connections. The free Maker Account (≤5 people, <$10k/mo revenue, <$100k funding) raises that to about 2,000 users. After that, Start is $399/mo billed yearly ($499 monthly) for 10,000 users. The 100-connection cap is the one to watch for a busy live class.
- **Design — "Ladder style",** after the team chat in the Ladder fitness app:
  - Flat, Slack-style rows rather than Stream's default bubbles: avatar, bold name and muted time, then plain text, everything left-aligned.
  - @mentions in the accent color.
  - Reaction pills with counts, plus an add-reaction button.
  - A "1 • View Thread" link with a line running down from the avatar.
  - Header: back button, a pill with the group photo, name and a dropdown to switch groups, and a pill with search and pinned messages.
  - A round scroll-to-bottom button.
  - Composer: round photo button, pill-shaped input, round send button in the accent color.
  - The coach's messages carry a badge (Stream's moderator role).
  - Dark, in Move Mindful's own navy (`#14142B`) and lavender (`#A99CFF`) instead of Ladder's black and lime.
- **Build notes:**
  - Our server creates the member's Stream token only after the Clerk session and `getViewerAccess()` checks, and sets channel membership itself.
  - Messages go from the browser straight to Stream — the one exception to "the browser never writes to the database", governed by that token.
  - `deleteMemberData()` must also delete the member's Stream user.
  - The message row is a custom component, built once for web and once for the Expo app.
- **Still open:** one community room or several groups, and who gets in.

Options considered:

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **Supabase Realtime** | Free (already in stack) | No extra vendor, real-time Postgres subscriptions, $0 cost | More DIY — you build the chat UI and features yourself |
| **Stream Chat** | Free to 1,000 MAU (Maker Account ~2,000), then $399/mo | Best-in-class React + React Native SDKs, moderation, threads, reactions, typing indicators | Steep jump from free to paid |
| **Sendbird** | Free up to 25 MAU, then $399/mo | Similar quality to Stream, good SDKs | Same price jump |
| **PubNub** | Free up to 200 MAU | Chat SDK available, cheaper paid tiers | Less polished than Stream/Sendbird |
| **Ably** | Free up to 200 MAU | Scalable real-time infrastructure | Lower-level, more UI work required |

---

## Build Order

### Phase 1 — Web app foundation
- [x] Next.js 16 + Tailwind CSS v4 app scaffolded
- [x] Turborepo monorepo with shared `packages/core`
- [x] Clerk authentication (sign-in/sign-up, route protection via `proxy.ts` middleware)
- [x] Vercel deployment with custom domain (`www.movemindful.com`)
- [x] Production Clerk keys configured on Vercel
- [x] Supabase database + RLS policies (`user_profiles`, `classes` tables)

### Phase 2 — Video classes on web
- [x] Mux integration
- [x] Class catalog UI (responsive grid with Mux thumbnails)
- [x] Video player (`@mux/mux-player-react`)
- [x] Class detail page (`/classes/[id]`)

### Phase 3 — Payments & access gating
- [x] RevenueCat + Stripe integration (Web Billing SDK)
- [x] Entitlements and access gating ("Move Mindful Pro" entitlement)
- [x] Pricing page with real offerings from RevenueCat
- [x] Subscription dashboard (plan status, renewal date, manage link)
- [x] Custom user menu (profile photo; Admin for admins, Account Settings, Help, Sign out) and an account page with plan status
- [x] Clerk user info synced to RevenueCat (name, email)
- [ ] 30-day challenge expiry tracking (future)
- [ ] Upsell flow from challenge (day 25+ prompts, day 30 lock — future)

### Phase 4 — Admin dashboard & content management
- [x] Admin role/access control (Clerk `publicMetadata.role` + server-side `requireAdmin()`)
- [x] Class management (Sync from Mux import, create, edit, publish/unpublish, delete + optional Mux asset deletion)
- [x] Tags & tag groups (unified taxonomy — "category" folded into tags; create/edit/delete)
- [x] Collections/playlists (manual hand-picked + smart tag-rule)
- [x] Drag-to-reorder within collections (`@dnd-kit`) + collection row ordering
- [x] Auto-populate collections based on tags (smart collections)
- [x] Member-facing browse UI (curated collection carousels; curation-only by design)
- [x] In-browser Mux direct upload — batch Upload page (`@mux/upchunk`), originally deferred
- [x] Live recordings importable from the Import page once Mux finalizes them; **Trim & import** to cut dead air into a new asset, then delete the raw recording
- [x] Instructors with profile photos (`004`), per-collection display limit + "auto-add new classes" (`005`), clip source tracking (`006`), an admin display date (`007`), per-class access — which entitlement a class requires (`008`)
- [ ] Automatic livestream recording into the library (Phase 7)

See [phase-4-plan.md](./phase-4-plan.md) for the full implementation plan, schema, and decisions (historical — some were superseded since).

### Phase 4b — One-time products and the funnel (the "Posture" pivot)
Not in the original plan: the library and live were paused to sell one-off products first. Details, decisions and the remaining launch list are in [postureproject.md](./postureproject.md).

- [x] Route groups: `(app)` (signed in, no entitlement: `/home`, `/account`, `/help`, products) and `(app)/(member)` (membership: `/classes`, `/live`); library and live locked to admins
- [x] One entitlement per product; server-side entitlement reads (`getViewerAccess()`); the membership check for `/classes` and `/live` runs on the server too
- [x] Products defined in `lib/products.ts`; public sales page + gated player per product; `Posture & Mobility Reset` with its own landing page (`/posture`)
- [x] Free lead magnet (`/posture-routine`, advertised at `/class1`)
- [x] Hidden free-membership signup (`/join/[code]`)
- [x] Clerk → Mailchimp (`signup`, `source:<slug>`) and RevenueCat → Mailchimp (`purchased:<slug>`, reconciled on every event)
- [x] ManyChat tag sync, with the contact id carried through sign-up by a cookie ([manychat.md](./manychat.md))
- [ ] End-to-end test of link → sign-up → purchase → tags ([Paytest.md](./Paytest.md))
- [ ] Real copy for `/pricing`

### Phase 4.5 — Exercise-by-exercise workouts
A new class format: short vertical (9:16) exercise clips, assembled into workouts in an admin builder and played back story-style (segmented progress bar, tap left/right to move between sets). Designed in two claude.ai design canvases (private to the owner): the [member player](https://claude.ai/artifact/QP3yY6AQbaYUJcx3qqU478) and the [admin builder, upload screen and exercise library](https://claude.ai/artifact/MuarX7i3BhFxZ5gyvDM977).

Built in vertical slices, so each step leaves something usable and real footage shapes decisions early:

- [ ] **0. Test footage** (in parallel) — film 3–4 exercises that cover the awkward cases: one done on each side (separate right and left loops), a timed hold with no reps, one with a tutorial, and a warm-up
- [x] **1. Playback test** — `/admin/lab/playback`: loop seams and next-clip handoff (MP4 static rendition vs HLS), preloading, sound after an automatic advance, full screen — on iPhone Safari and desktop. Result (Sep 2026): looping, preloaded clip changes and sound after an advance all worked on iPhone and desktop. Decision: exercise clips play as **MP4 static renditions** in plain `<video>` elements (a pool: current + next two preloaded); the player still "unlocks" sound on the upcoming clips during the Begin tap as a cheap safeguard for iOS. The lab page and its two test clips go once the real player exists
- [ ] **2. Exercises** — Supabase tables (exercises: kind exercise / warm-up, sided, timed-only, dumbbell levels, equipment, archived; exercise videos: tutorial / loop / right loop / left loop with reps-in-clip; exercise tags), then the admin upload, library and edit screens (reusing the existing Mux direct upload). Then upload the real exercise library through them
  - [x] Schema (`009_exercises.sql`) and `/admin/exercises` library, upload and edit screens — clips are Mux direct uploads with 1080p + 720p MP4 static renditions, status synced from Mux on page load
  - [x] Apply `009_exercises.sql` in Supabase
  - [ ] Upload the real exercises; confirm the 1080p MP4s look right on a phone
- [ ] **3. Workouts** — workouts and their blocks (single exercise with sets / rest / superset or circuit with rounds), the builder, and the time estimate in `packages/core` with tests so every platform computes the same number
  - [x] Estimate + group labels in `packages/core/src/workouts.ts` (tests: `npm test -w @move-mindful/core`); schema `010_workouts.sql` (blocks table + atomic `save_workout_sequence`); `/admin/workouts` list and builder; "used in N workouts" and the delete guard in the exercise library
  - [x] Apply `010_workouts.sql` in Supabase
  - [x] Rest between sets on single exercises; uploaded workout cover image (`011_workout_set_rest_and_cover.sql`)
  - [x] Apply `011_workout_set_rest_and_cover.sql` in Supabase
  - [x] Build a real workout once exercises are uploaded ("Demo Workout")
  - [x] **Generate with AI** in the builder: optional criteria (blank = Claude's call); Claude drafts from the finished library and the published workouts (the house style) in a JSON schema mirroring the sequence; fills the builder unsaved, with notes, Try again, Change criteria and Undo (`lib/workouts/generate.ts`)
  - [x] Exercise intensity, 1–4 (`014_exercise_intensity.sql`), set in the exercise form and shown in the library; Generate with AI uses it to vary a workout's rhythm
  - [x] Apply `014_exercise_intensity.sql` in Supabase
  - [x] Add `ANTHROPIC_API_KEY` to Vercel (and `.env.local` for local use)
  - [x] Editable instructions for Generate with AI ("Edit instructions" in the window; default in `lib/workouts/generator-prompt.ts`, saved copy in `app_settings` via `015_app_settings.sql`); the technical rules stay fixed
  - [x] Apply `015_app_settings.sql` in Supabase
  - [x] "Pairs well with" on exercises (`016_exercise_pairings.sql`, both ways): Generate with AI reaches for them first when grouping, and the builder suggests them when adding to a superset or circuit
  - [x] Apply `016_exercise_pairings.sql` in Supabase
- [ ] **4. Member player (web)** — preview → warm-up → player (reps, timed, sided, groups, rests, tutorial modes) → pause → end → complete. Mobile layout first, then the desktop theater layout
  - [x] Player steps (`workoutSteps`) and state machine (`playerReducer`) in `packages/core`, with tests
  - [x] `/workouts/[id]` preview + player, mobile layout, and the desktop theater layout; a `/workouts` list — admin-only (section lock) until step 6
  - [x] `/demo1` — a public, unindexed sample playing the "Demo Workout" (only while it's published)
  - [x] Exercise montage on every workout preview: three seconds per distinct exercise (once per cycle across all sets, circuits, supersets and sides), silent, soft fades, two video elements, pause/play, visibility pausing and a still-cover fallback for reduced motion or unavailable playback
  - [ ] Verify the overview montage on a physical iPhone: autoplay, three-second transitions, pause/resume and Begin/Resume handoff
  - [x] Test on iPhone Safari and desktop with real footage (the "Demo Workout"), with many rounds of phone-driven refinements: three tap zones (back / pause / next), swipe to minimize and to open the overview, drawers that follow the finger, a loading spinner, a first-run guide to the controls
  - [x] Settings, saved to the account: tutorial mode (Loop / Play once / Off), instructor audio, "Keep my music playing" (Audio Session API — Safari and Firefox; Android deferred), auto-advance (Loop can't be combined with it)
  - [x] A 6-second "Get ready" countdown before each exercise (exercise name, reps or time, side, set, dumbbell level, over its first frame; Pause / Start now) — after a tutorial and whenever a set starts without a rest counting down into it — or after a rest into a different exercise (only a rest between sets of the same exercise skips it); timed sets and auto-advance start after it, and an auto-advancing rep set now counts just the reps' time (`workSeconds`), since getting into position happens during Get ready. Core `readyMs`, with tests
  - [x] Intro, outro and cool-down videos (`018_intro_outro_cooldown.sql`): each workout can have its own intro (before the warm-up) and outro (before the summary), uploaded in the builder (`workout_videos`), and a cool-down from the library (a new exercise kind, like warm-ups). After the last exercise a workout with a cool-down asks "Cool down?" — yes plays it, no moves on — then the outro, then the summary. All optional and skippable; the workout counts as done when the exercises are. Core phases `intro` / `cooldownPrompt` / `cooldown` / `outro`, with tests
  - [x] Apply `018_intro_outro_cooldown.sql` in Supabase
  - [x] Instructor audio tips (`019_workout_audio_tips.sql`): a short recording for any set (each side of a sided one) or rest — the rests between sets and rounds included — recorded from the microphone in the builder's **Audio tips** view (Edit | Audio tips on the Sequence), AAC in the public `workout-tips` bucket, saved with the sequence (`workout_blocks.tips`; core `TipMap` / `TipSlot`, with tests). In the player a set's tip plays 3 s into the exercise (after the tutorial and Get ready) and a rest's 1 s in, with the workout instructor's photo sliding in, ringed by equalizer bars; it stops when the set or rest ends, holds while paused, and is skipped with instructor audio off
  - [ ] Apply `019_workout_audio_tips.sql` in Supabase
  - [x] Audio tips trim their own dead air: the speech is found right after recording (core `speechBounds`, with tests) and the tip plays only that part (`start` / `end`), in the player and the builder's preview; earlier recordings are trimmed when the Audio tips view opens
  - [x] The tip bubble's equalizer bars follow the voice: the builder measures each recording's loudness as it trims it (core `voiceLevels`, with tests; `levels` on the tip, no migration — older tips are read when the Audio tips view opens, then saved), and the player scales the bars by it at the tip's place in its file. Tips without levels keep the plain flicker
  - [x] An Audio card behind the sound button (phones) and a new Audio button in the desktop column: Music and Sound effects (placeholders), Audio tips, and Mute all at the bottom (the old instructor-audio setting); Settings no longer has a Sound section. Keep my music playing is hidden and off for user testing (`KEEP_MY_MUSIC`)
  - [x] Music for user testing: one sample track looped under the workout (`components/workouts/music.ts`), ducking under tutorials, tips, intro and outro, with its own levels for the warm-up and cool-down — all tunable in `MUSIC`; through Web Audio for iPhone volume control
  - [x] Add the sample track: `apps/web/public/audio/workout-music.m4a` (30 min, AAC 128 kbps, 30 MB)
  - [ ] Tune the music levels by ear on iPhone and desktop (`MUSIC` in `components/workouts/music.ts`)
  - [x] Up next card + chime ten seconds before a self-ending set ends (timed, or reps on auto-advance; sets of 10 s or less, and the workout's last set, skip it), sliding in from the right to the centre, a little above the tip bubble's line (a set's tip comes early, so they never meet), in the frosted grey of the other controls
  - [x] Sound effects: a 3-second countdown over the last seconds of every rest and Get ready (`COUNTDOWN` in `cue-audio.ts`, which tips now share: one cue player for anything that plays a set time into a step)
  - [x] An "All levels" workout level (`020_workout_level_all.sql`), alongside Beginner, Intermediate and Advanced: in the builder, Generate with AI and everywhere members see a workout's level
  - [ ] Apply `020_workout_level_all.sql` in Supabase
  - [ ] Black status bar around the notch during the player (phones): theme-color → black and a black page background while the player is up are both in, but the user's iPhone still shows purple — parked 2026-10-01; next, find out whether it's the home-screen app or Safari
  - [ ] Try audio tips on iPhone Safari (a tip starting on its own after the Begin tap's unlock; with "Keep my music playing" on and off)
  - [ ] Remove the playback lab (`/admin/lab/playback`) and its two test clips
  - Not built yet: tutorial captions (Mux auto-generated subtitles were looked at; on hold) and coaching cues (the design shows them; exercises have no caption/cue data yet)
- [ ] **5. Progress** — save progress / resume with % complete, completed-workout history
  - [x] Player settings (tutorial mode, instructor audio, warm-up) saved to the member's account — `012_member_preferences.sql` (a `member_preferences` row per Clerk user, settings as JSON by area)
  - [x] Apply `012_member_preferences.sql` in Supabase
  - [x] A workout sessions table (`013_workout_sessions.sql`: started, finished, sets done, % and time, where to resume, a fingerprint of the sequence) — saved as the member goes (Begin, every new set, the end), so Resume survives a closed page; End workout offers Save progress / Discard progress; the preview offers Resume · N% complete / Start over, for 7 days after the last save; `/workouts` cards show "Resume · N%" or "Done · 3 days ago". Signed-in only (on `/demo1` too). Resume logic in `packages/core/src/workout-progress.ts`, with tests
  - [x] Apply `013_workout_sessions.sql` in Supabase
  - [x] Ratings: members rate a workout out of five stars on its summary (one per member per workout, `017_workout_ratings.sql`); the admin workouts list shows ★ average (count) with a Highest rated sort, and the builder a Rating card with the breakdown. The workout preview shows "✓ Done · when" once a member has finished it
  - [x] Apply `017_workout_ratings.sql` in Supabase
  - [ ] Later: use a member's highly rated workouts as context for workouts generated for them (member-side Generate with AI)
  - [ ] Show completion history and "time since last workout" — the data is recorded; where it appears is decided with `/home` (step 6)
  - [ ] **Exercise minutes: a running total per member** (added Oct 2026), for the member to see (with `/home` placement, step 6, and in the app) and for the admin per member. Buildable now on the web — no app needed: every session already saves its exercise time (`workout_sessions.active_seconds`: pauses and the warm-up excluded, and the cool-down too, since a session completes when the exercises do). The total is the sum over a member's sessions, shown also by week and month. To decide: whether unfinished sessions count (they were still exercise — likely yes), and whether the warm-up and cool-down should count after all (they'd need their time recorded). Signed-in only, so `/demo1` visitors have no total
- [ ] **6. Access and placement** — which entitlement unlocks workouts (membership, a standalone product, or both — undecided) and where they appear on `/home`. The iOS app reuses the `packages/core` logic in Phase 5
  - [ ] **Engagement tracking, in place by launch day** (Ladder-style activation metrics). Day 1 for a member's workout metrics is **when they could first do workouts** — the later of when they got workout access (the entitlement's start, from RevenueCat's purchase events; backfilled from RevenueCat for existing members) and the workouts launch date — **not** their Clerk account creation, since many accounts were made months earlier for the free class. Record per member, as separate milestones: account created (Clerk), workout access started, **first opened Workouts** (the list or a workout preview), first workout started, first workout finished. Then report: first-workout rate, workouts in the first 7 days (0 / 1 / 2 / 3+), 3 in week 1, week 1 → week 2 continuation, weekly frequency by cohort, and 20 in 6 weeks. The session data these need is already saved (`workout_sessions`: started / finished / discarded, percent, active time); a reporting rule like "done = finished, or 85%+" needs no schema change. Free-class-only accounts without access stay out of this funnel (their funnel — signup → purchase — is the Mailchimp / ManyChat tags). A new member-keyed table goes in `deleteMemberData()`. Later: milestone tags to Mailchimp / ManyChat for behaviour-based emails, and recording class plays if classes should count as working out

Key product rules from design review:
- An exercise has a tutorial (with audio) and a looping clip; sided exercises have separate right and left loops. "Reps in clip" gives the pace used for time estimates (blank = timed only)
- Dumbbells are levels, never pounds: an exercise lists every level that works ("Light / Medium"); a workout's equipment shows one pill per level
- Intensity is a plain 1–4 (higher is more intense) with no descriptive words, so the meaning stays the admin's; optional, exercises only; it's for programming (Generate with AI) and isn't shown to members
- "Pairs well with" goes both ways and is a preference, not a limit: Generate with AI favours pairings but may group other exercises
- Generate with AI never saves: it fills the builder, and the admin reviews and saves like any edit
- A workout is a list of blocks: a single exercise (sets, with rest between sets), a rest, or a group (rounds, rest between exercises, rest between rounds; exercises in a group do one set each). Two exercises = "Superset N", three or more = "Circuit N"
- The warm-up is optional for members and plays once, start to finish; listed workout times exclude it
- The intro and outro belong to one workout; the warm-up and cool-down are library videos shared between workouts. The cool-down is offered at the end ("Cool down?") rather than switched on or off up front. None of them count in listed workout times, and the workout counts as done once the exercises are
- Editing an exercise changes it in every workout that uses it; a replaced clip stays live until the new one finishes processing. Archiving hides an exercise from the library and builder search while existing workouts keep working; delete only when nothing uses it
- Ending a workout early asks to save progress or discard it; saved progress shows "Resume · N% complete" on the workout preview

### Across phases (Sep 2026)
- [x] Phone navigation: a floating iOS-style tab bar replaces the header links below tablet width
- [x] Loading states (`loading.tsx`) for every signed-in, player and admin page, so taps respond at once and Next.js can prefetch; pages that only need the admin role no longer call RevenueCat
- [x] Account deletion cleanup: Clerk's `user.deleted` webhook removes the member's rows (`lib/member/delete-server.ts`)
- [ ] **Time from account creation to first paid purchase** (any product or the membership). Account created = the Clerk user's creation date; first paid = their earliest real purchase in RevenueCat — not a promotional grant (like the `/join` free membership) or a sandbox purchase. Store both per member (first paid set by the RevenueCat webhook the first time it sees a paid purchase; existing members backfilled from Clerk and RevenueCat), then report days to first purchase — median and spread, which product came first, and by how they signed up (the free class via ManyChat vs. straight to a product page). Unlike the workout metrics, this one *does* start at account creation, so the free-class signups are exactly who it measures. A new member-keyed table goes in `deleteMemberData()`
- [ ] Deleting an account doesn't cancel a paid subscription or remove Mailchimp/ManyChat/RevenueCat copies — decide how to handle before promoting self-service deletion (and before the iOS app, which Apple requires to offer it)

### Phase 5 — iOS app
- [ ] **First: move the workout player's screen logic into `packages/core` (a "view model")**, so the web and iOS players can't drift apart. The action rules already live in core (`playerReducer`); what's still inside the web component (`components/workouts/workout-player.tsx`) is which screen shows, which buttons appear with their labels and actions, the text lines ("Up next", "Set 2 of 3") and the progress fills — plus rules like pause holding a rest or get-ready countdown in place, Next resuming a held countdown first, "Restart tutorial" and a hidden "Watch the tutorial" during a tutorial, Settings only while a countdown is held (phones), Restart workout honouring the Warm-up setting, when the first-run guide opens and when progress is saved. Core returns all of that from the state, workout and settings, with tests; each platform only draws it and sends actions back. Keeps per platform: looks, input (taps, swipes, keys), video (the web's video pool / `expo-video`), the audio session, wake lock and storage. Refactor in stages with no visible change on the web. Deliberately left until the web player's week-to-week tweaks settle
- [ ] Reuse `packages/core` logic and services
- [ ] An API for the app: the web loads data through server components and server actions, which a native app can't call, so add route handlers (browse and collections, a class's playback, a workout and its clips, saving progress and settings) that verify the app's Clerk session token and check entitlement with the same server code (`getViewerAccess()`), returning JSON
- [ ] Expo + React Native app — screens rebuilt with native components (NativeWind can keep Tailwind-style classes) to the settled designs
- [ ] **iPad — the same app, not a separate one** (added Oct 2026). One universal app: one App Store listing, one codebase; access follows the Clerk account and Apple subscriptions follow the Apple ID, so an iPad unlocks everything its owner has. `app.json` already has `supportsTablet: true` (Expo's default).
  - **Sideways, it mirrors the website's desktop layouts**, by the web player's own rule — the "theater" layout at 1024 wide and at least 5:4 (`THEATER_QUERY` in `components/workouts/theater.tsx`, which already counts iPads held sideways). Upright, it uses the phone layout, as the website does on an iPad today. The rule goes by window size, not device, so Split View / Stage Manager windows that get narrow fall back to the phone layout. The other screens (home, browse, account) follow the same pattern.
  - **Rebuilt, not reused:** React Native can't run the web's HTML/CSS, so each layout is rebuilt to match (NativeWind keeps the Tailwind-style classes close). Not a web page wrapped in the app — Apple rejects those (Guideline 4.2), and it would lose native video and audio. Move the theater rule into `packages/core` with the player's view model, so web and app can't disagree.
  - **Touch versions of desktop-only bits:** the desktop first-run guide's arrow-key and Esc pages, and anything that only reacts to hover. Keys can still work with a keyboard attached.
  - **Rotation:** `app.json` is portrait-only today; iPads need to rotate, while iPhones can stay portrait-only. iPad screenshots for the App Store listing.
  - **Option:** launch iPhone-only (`supportsTablet: false` — iPads get the iPhone version in a scaled window) and bring the iPad layouts in a later update to the same app.
- [ ] Clerk login with `@clerk/expo`'s native `AuthView` (see iOS App Sign-in) — same account as web; identify RevenueCat with the Clerk user ID. Also: the Native API on and the iOS app registered in the Clerk dashboard, a development build, and a 401 JSON error (not the `/sign-in` redirect) from `proxy.ts` for the app's API routes. Sign-ups in the app (leaning), with account deletion in the app
- [ ] Apple payments (if the app becomes the storefront — see Purchasing & Platform Strategy): products in App Store Connect; the iOS app added to the RevenueCat project and connected to App Store Connect, its products attached to the existing entitlements; `react-native-purchases` logged in with the Clerk user id before any purchase; RevenueCat's paywall, hidden from anyone already entitled; a Restore purchases button; enroll in the App Store Small Business Program (15%); the website's account page shows "Billed through Apple — manage it on your iPhone" for Apple subscriptions
- [ ] Entitlement gate (`react-native-purchases`) — unlock on "Move Mindful Pro", else show "membership required"
- [ ] Apple Health (iOS app only; browsers can't): at launch, save finished workouts to Health (HealthKit); later, show the watch's heart rate on the summary. A true Apple Watch app (live heart rate, controls on the wrist) needs a separate Swift watchOS app — a future project, not launch (designed: see the next item)
- [ ] **Apple Watch companion app** (future project, not launch; designed Oct 2026): designed in a claude.ai design canvas (private to the owner), the [Apple Watch companion](https://claude.ai/artifact/9c5H5HiqQzRE9sS7zcM46i) — build to **variation A ("Glance")**, the rows marked A; B and C are alternatives that weren't chosen. It does nothing without a workout running: just the mark and "Start a workout on your iPhone" (the iPhone can open the watch app itself when a workout begins, with HealthKit's `startWatchApp`). During a workout, three pages: Controls (Back, Pause/Resume, Next, Mute, Auto-advance, End) | Main | Apple's own Now Playing (`NowPlayingView`). Main shows the reps or time, side and set, heart rate and calories, and a whole-workout bar with time elapsed and time left; the number fills purple from the bottom during work (sets, warm-up, cool-down) and drains during rests and Get ready. Also designed: warm-up (the same screen serves the intro, cool-down and outro), tutorial, Get ready and Workout complete (Time, Calories, Avg heart rate, Sets). No pause screen — Pause on Controls turns into Resume. Live heart rate and calories mean the watch runs its own workout session (`HKWorkoutSession`), which also gives the next item its number. Still open: time left as a ticking "−9:18" or the phone's "~9 min" (it's an estimate), and whether the watch can answer "Cool down?"
- [ ] **Calories burned, once the Apple Watch integration exists** (added Oct 2026): the watch's active energy for each workout (from its workout session, or read from HealthKit for the workout's time window) saved with the session (a new `workout_sessions` column, so `deleteMemberData()` already covers it), a running total per member alongside exercise minutes, and the number on the summary. Health data needs the member's permission per data type, a privacy policy that covers it, and can't be used for advertising (App Review checks); keep only what's shown. Without a watch, no number — an estimate from duration and intensity could come later if wanted
- [ ] **Live heart rate on the phone's player, once the Apple Watch app exists** (added Oct 2026): while the watch's workout session is running, the iOS app's player shows the member's current heart rate on its main screen (the set and rest screens): a small heart and BPM, kept minimal like the rest of the player so the video stays first — placement to design. The phone can't read live heart rate from HealthKit (the watch's samples reach it late), so the watch sends it: its workout session mirrored to the iPhone (`startMirroringToCompanionDevice`, watchOS 10 / iOS 17), or WatchConnectivity messages. Hidden when there's no watch or it stops sending; iOS app only, since the web player can't get it. Shown live, not stored — the summary's figure comes from the Apple Health item above
- [ ] **App opens and time spent in the app** (added Oct 2026), viewable over any time frame — day, week, month, or a custom range: opens, total and average time in the app, how many members opened it (daily / weekly / monthly actives), per member and for everyone. An open = the app coming to the front (from closed, or back from the background after a short gap, so a quick switch away doesn't count twice); time spent = until it goes to the background. Recorded from the app's foreground/background events and sent to the server in batches (offline-safe). To decide: our own events table (Supabase, member-keyed so `deleteMemberData()` clears it, with an admin dashboard page for the time frames) or an analytics service with a React Native SDK and dashboards built in (e.g. PostHog). Either way it's declared in the App Store privacy label; no tracking across other companies' apps, so no App Tracking Transparency prompt
- [ ] Music, as in Ladder (iOS app only; the web keeps today's "Keep my music playing"): **a music-app shortcut** — the member picks Spotify, Apple Music, YouTube Music… once in settings (only the ones installed, via `canOpenURL`), and a button on the workout overview and the pause screen opens it. Plain app links, so no Spotify API, approval or account linking; it could later open a Move Mindful playlist. **Our sound keeps going while they're over there** — background audio, plus a session that mixes with other apps' audio, so starting their music doesn't stop ours and ours doesn't stop theirs; unlike Safari's "ambient" mode it ignores the Silent switch, so no "silent mode must be OFF" note. **The workout keeps running too** (as Ladder's does) — time it from the clock, not by counting ticks, so it stays right if iOS suspends the app during silent exercise loops. **Duck their music under the instructor** — lower it during tutorials and the intro, warm-up, cool-down and outro (the clips with sound), full volume for exercises and rests, switching at those boundaries; iOS picks how far it drops. Setting: pause my music / keep it playing / lower it while the instructor talks
- [ ] Unpaid-user paywall: **US** — app-to-web checkout button (deep-link to RevenueCat Web Billing, return with entitlement unlocked); **non-US fallback** — generic "membership required" state, no link (anti-steering). Verify App Review + legal status before shipping

### Phase 6 — Push notifications
- [ ] Now Playing (lock screen, Dynamic Island) for a workout: the app publishes one entry itself — the workout's title, instructor, cover and progress, with play/pause and skip wired to the player — set at Begin and updated as it goes, and the tips, countdown, chime, videos and music all play without taking it over. (In iPhone Safari the island comes and goes during a workout, as each of those sounds takes its turn and iOS briefly pauses the music when a video with sound starts. Not fixed on the web: there, iPhones are for testing until the app — see the next item.)
- [ ] iPhone browsers go to the app: once it's out, an iPhone opening the site (the player above all) is sent to the app (a Smart App Banner, or a prompt) rather than using the web player. Laptops and desktops keep the web version for good
- [ ] Expo Notifications for iOS
- [ ] New class alerts, challenge reminders, live stream starting

### Phase 7 — Livestreaming
- [ ] Mux Live for one-to-many broadcast
- [ ] Auto-record livestreams for on-demand library (via Phase 4 admin tools)

### Phase 8 — Group chat
- [x] Evaluate options — chose Stream Chat with a Ladder-style design (see Group Chat above)
- [ ] Build when community engagement becomes a priority

---

## Early Implementation Notes

- `@move-mindful/core` is consumed as a source-only internal package (`src/index.ts`); the web app compiles it through `transpilePackages` and imports the workout model from it. Verify the same imports from Expo when the iOS app starts. Its original access helpers (`types.ts`, `access.ts`) model the old challenge world and are unused — rewrite them into the shared access model then.
- Shared domain models may use `Date` for in-memory logic, but API and database payloads should use explicit wire/DTO types with ISO date strings before Supabase and API routes are introduced.

---

## Hosting & Infrastructure

| What                  | Where it lives       | Status | Cost                                      |
|-----------------------|----------------------|--------|-------------------------------------------|
| Website + API routes  | Vercel               | ✅ Live at `www.movemindful.com` (functions in `iad1`) | Free (hobby) → $20/mo (pro) |
| Domain                | GoDaddy              | ✅ `movemindful.com` → Vercel   | ~$15/year                    |
| Auth                  | Clerk                | ✅ Production keys configured    | Free → $25/mo (pro)         |
| Database + storage    | Supabase             | ✅ Tables + RLS live (`us-east-1`) | Free → $25/mo (pro)      |
| Video files + CDN     | Mux                  | ✅ Player + catalog live        | Pay-per-use                  |
| Payments/Subs         | RevenueCat + Stripe  | ✅ Web Billing live             | RevenueCat free → $25/mo; Stripe 2.9% + 30¢ |
| AI (admin only)       | Anthropic API        | ⬜ Needs `ANTHROPIC_API_KEY`    | Pay-per-use: a few cents per generated workout |
| iOS app distribution  | Apple App Store      | ⬜ Not yet set up               | $99/year                     |

### Estimated Monthly Costs by Stage

| Stage | Users | Revenue | Estimated Costs | Margin |
|---|---|---|---|---|
| Launch | 0–100 | $0–1,000/mo | ~$0–50/mo | — |
| Early growth | 100–500 | $1,000–5,000/mo | ~$100–300/mo | ~90–95% |
| Growth | 500–1,000 | $5,000–10,000/mo | ~$400–700/mo | ~90–93% |
| Scale | 5,000+ | $50,000+/mo | ~$2,500–3,500/mo | ~93–95% |

**Note:** Every service in the stack has a free tier, and costs scale with revenue. Two upgrades are due **before launch** regardless of traffic:

- **Vercel Pro ($20/mo)** — the Hobby plan is restricted to non-commercial, personal use (Vercel's fair-use guidelines), and a store taking payments isn't that. Pro also adds a day of runtime logs (vs an hour), spend management and email support. It won't noticeably change speed: Fluid compute's cold-start reductions are already on for this project.
- **Supabase Pro ($25/mo)** — the free plan has **no backups** (Pro keeps daily backups for 7 days) and pauses a project after a week without activity. Everything built in the admin CMS lives there.

The Apple Developer Program ($99/year) follows when the iOS app is ready to publish.

---

## Key Decisions & Rationale

- **TypeScript everywhere** — one language across web, mobile, and backend; keeps every door open
- **React + React Native over Flutter** — Flutter's web output is weak for video-heavy apps; TS ecosystem is stronger for co-equal web + mobile
- **Monorepo over separate codebases** — share types, API client, business logic; rebuild only the UI per platform
- **Mux over Cloudflare Stream** — better React SDK, superior analytics (Mux Data), more polished livestreaming
- **Clerk for auth, RevenueCat for payments** — Clerk handles identity (who is this person?), RevenueCat handles commerce (what have they paid for?). Clean separation of concerns
- **RevenueCat over Clerk Billing** — subscriber management dashboard, cohort analytics, A/B testing, cross-platform entitlements, and seamless path to Apple IAP if needed later
- **No in-app purchases at launch** — avoids Apple's 15-30% cut; web is the storefront, app is the experience; proven model (Netflix, Spotify, Kindle). RevenueCat makes adding IAP trivial later if needed. **Under review (Oct 2026):** leaning toward selling through Apple in the app instead — see "Leaning: the app becomes the storefront"

---

## Security Guidelines

Clerk handles the hardest security problems (password storage, sessions, OAuth, CSRF, rate limiting, 2FA), but it doesn't make the app automatically secure. The following guidelines address the remaining risks — especially important when using AI to generate code.

### What Clerk Covers
- Password hashing and storage
- Session management (tokens, expiry, refresh, cookies)
- OAuth flows (Sign in with Google/Apple)
- Brute force / rate limiting on login
- Email verification, magic links, 2FA
- CSRF protection via middleware

### What Clerk Does NOT Cover

**1. Authorization — the #1 remaining risk**

Clerk tells you *who* someone is, not *what they can do*. Every API route must derive the user ID from the Clerk session, never from the URL or request body:

```typescript
// BAD - anyone can fetch any user's data by guessing an ID
app.get('/api/user/:id/videos', (req, res) => {
  const videos = await db.getVideos(req.params.id)
  return videos
})

// GOOD - only return data belonging to the logged-in user
app.get('/api/my-videos', (req, res) => {
  const userId = req.auth.userId  // from Clerk
  const videos = await db.getVideos(userId)
  return videos
})
```

**2. Auth middleware on every route**

Every protected API route needs Clerk's middleware. If a new route is created without it, it's publicly accessible to anyone on the internet. Default to protected; explicitly opt out for public routes, not the other way around.

**3. Secret key exposure**

Never put API keys, Supabase service keys, or Stripe secret keys in client-side code. In Next.js, environment variables prefixed with `NEXT_PUBLIC_` are visible in the browser — secret keys must never use that prefix. Keep them in `.env` server-side only.

**4. Webhook verification**

A webhook route is public by necessity, so it must prove who sent each request before trusting it — otherwise someone could fake a signup or a purchase. The app's two receivers:

- **Clerk** (`/api/webhooks/clerk`) — verifies the Svix signature (`CLERK_WEBHOOK_SIGNING_SECRET`).
- **RevenueCat** (`/api/webhooks/revenuecat`) — RevenueCat doesn't sign payloads, so it compares a long shared secret sent in the Authorization header (`REVENUECAT_WEBHOOK_AUTH`).
- **Stripe**, if its webhooks are ever consumed directly — `stripe.webhooks.constructEvent()`.

Each receiver must also be listed as public in `proxy.ts`.

**5. Supabase Row Level Security (RLS)**

Enable RLS on every table. Without it, anyone with the Supabase publishable key could query the database from the browser. The app uses two patterns:

- **Catalog tables** (classes, tags, collections, …) — read policies where members need them; writes only through admin server actions with the service-role key.
- **Member-owned tables** (`member_preferences`, `workout_sessions`) — RLS on with **no policies**, so the browser can't touch them at all; the server reads and writes them with the service-role key, taking the member from the Clerk session.

**6. Server actions are public endpoints**

A server action can be called by a direct POST, bypassing the page that shows it. Every action checks auth itself — `requireAdmin()` for admin actions, `auth()` for member actions — and validates its input as untrusted.

**7. Account deletion**

When a member deletes their account, their data goes with it: any new table keyed by a Clerk user id must be added to `deleteMemberData()` (`lib/member/delete-server.ts`).

### Security Checklist (for every new feature / AI-generated code)

- [ ] User ID is derived from Clerk session, not from URL or request body
- [ ] Clerk auth middleware is applied to the API route
- [ ] No secret keys in `NEXT_PUBLIC_` env vars or client-side code
- [ ] Every webhook verifies its sender (Svix signature, shared secret, or `constructEvent()`) and is listed in `proxy.ts`
- [ ] RLS is enabled on any new table (member-owned: no policies, server-only)
- [ ] Every new server action checks auth itself
- [ ] New member-keyed tables are cleared by `deleteMemberData()`
- [ ] Ask: "What happens if a logged-in user changes the ID in this request to someone else's?"

---

## Future Considerations

- **Apple IAP via RevenueCat** — RevenueCat already supports Apple IAP; flip it on if App Store discovery becomes a meaningful acquisition channel and in-app purchase conversion justifies the Apple commission
- **Chromecast support** — requires Google Cast SDK integration, not automatic like AirPlay
- **Mux signed playback** — every asset is public today, so a playback id streams to anyone who has it. Signed policies with short-lived tokens minted server-side would close that; worth it once sharing shows up or revenue justifies the work (see [postureproject.md](./postureproject.md))
- **Android app** — React Native / Expo supports Android out of the box; add when there's demand
- **Free trial, no credit card (likely, Oct 2026)** — 7 days of access at sign-up, then the Apple paywall in the app (see "Leaning: the app becomes the storefront"). The `/join` free membership already grants a lifetime promotional entitlement (`lib/revenuecat-admin.ts`); the trial is the same call with an end date. Originally: a possible top-of-funnel option to let users try Move Mindful free for a fixed window (e.g. 7–14 days) without entering a card. Recommended mechanism if pursued: a RevenueCat **promotional entitlement** (a grant, *not* a standard subscription free trial, which would require a card) granted server-side at Clerk signup (`user.created` webhook → RevenueCat REST API, secret key). Keeps RevenueCat as the single source of truth — the existing entitlement gate works unchanged on web + mobile, and conversion to paid is the same "Move Mindful Pro" entitlement (no migration). Trade-off: no-card trials are easily abused via new accounts. Likely, not built yet.
- **Apple external purchase link (app-to-web)** — as of the 2025 *Epic v. Apple* contempt ruling, US apps can link out to external web checkout with **no Apple commission and no scare screen** (this replaced Apple's early-2024 regime of ~27% + a scare screen). RevenueCat's app-to-web flow implements this against Web Billing — see "iOS App = Experience" above. Still **US-only**; the Ninth Circuit largely upheld it (Apple may later charge a cost-based fee, amount not set) and Apple has taken it to the Supreme Court — monitor the legal status and keep a no-link fallback for other storefronts. With the app as storefront (the Oct 2026 leaning), this becomes an optional later addition. If the ruling is reversed, fall back to the reader-app (no-link) model — the underlying checkout doesn't change
