# Move Mindful

A video fitness platform: on-demand classes, exercise-by-exercise workouts, livestreaming, and — later — push notifications and community features. Web and iOS are co-equal platforms: the web is the storefront (where purchases happen), the iOS app will be the logged-in experience.

## Current Status

**Live at [www.movemindful.com](https://www.movemindful.com).** Phases 1–4 are done: the web foundation, Mux video, RevenueCat payments with entitlement gating, and the admin CMS with a curated, collection-based browse. **Phase 4.5 — exercise-by-exercise workouts — is mostly built**: the exercise library, the workout builder, the member player and saved progress. What's left there is deciding which purchase unlocks workouts and where they sit on `/home`. The full build order, with checkmarks, is in [plan.md](./plan.md).

> **Product status — the class library, live stream and workouts aren't open to members yet.**
> What's for sale is a one-time purchase with lifetime access, `Posture & Mobility Reset`
> (`/posture`, five classes), alongside a free lead magnet, the `12 Minute Posture and
> Mobility Routine` (advertised at `/class1`). The on-demand library and live classes return
> later under the recurring membership; how workouts will be sold is undecided. Until then
> `/classes`, `/live` and `/workouts` are locked to admins (`requireSectionUnlocked()` in
> `lib/auth/locked-sections.ts`, plus an optimistic redirect in `proxy.ts`) — built and
> previewable, but not reachable by members. Signed-in users land on `/home` instead
> (`MEMBER_HOME` in `lib/routes.ts`). The pivot is written up in [postureproject.md](./postureproject.md).

## What's in place

### Monorepo

- Turborepo with npm workspaces and a shared `tsconfig.base.json`.
- **`packages/core`** — shared TypeScript, consumed as source (no build step; the web app lists it in `transpilePackages`), ready for the iOS app to reuse:
  - `workouts.ts` — the workout sequence model, its time estimate (`estimateWorkout()`), group labels (`groupLabels()`) and the steps a player walks (`workoutSteps()`)
  - `workout-player.ts` — the player's state machine (`playerReducer()`), including tutorial modes and auto-advance (`fitTutorialMode()`)
  - `workout-progress.ts` — saved progress: `workoutProgress()`, `sequenceKey()`, `resumeFrom()` and the 7-day `RESUME_WINDOW_MS`
  - Unit tests for all three, on Node's built-in runner (see [Test](#test))
  - `types.ts` / `access.ts` — the original membership + 30-day-challenge types and helpers (`hasAccess()`, `shouldShowUpsell()`, …). **Unused**: the live access model is one RevenueCat entitlement per product, read server-side in the web app. See [Known tech debt](#known-tech-debt--dormant-code).
- **`apps/mobile`** — an Expo 56 / React Native starter screen; no integrations yet.

### Web app (`apps/web` — Next.js 16, Tailwind CSS v4)

**Accounts, access and payments**

- **Clerk authentication** — sign-in/sign-up, `ClerkProvider`, route protection in `proxy.ts`. Admins carry `publicMetadata.role = "admin"` as a session-token claim, checked optimistically in the proxy and authoritatively on the server (`requireAdmin()` / `isAdmin()` in `lib/auth/admin.ts`).
- **RevenueCat + Stripe payments** — Web Billing checkout. The public `/pricing` page renders offerings for logged-out visitors through an anonymous RevenueCat config; sign-up is only required at the point of purchase, and `?redirect_url=` brings the buyer back to finish checking out. It lists only what's actually on sale.
- **Server-side entitlement reads** — `getViewerAccess()` / `viewerCanAccess()` (`lib/auth/viewer.ts`) read the viewer's live entitlements from RevenueCat's REST API (`getActiveEntitlements()` in `lib/revenuecat-admin.ts`). They fail closed, are cached per request, and skip RevenueCat entirely for admins. Pages that only need "is this an admin?" call `isAdmin()` instead, which reads the session and costs nothing.
- **One-time products** (`/[product]`, `/[product]/[video]`) — short video series sold outright, defined in `lib/products.ts`: a slug, a RevenueCat entitlement + product id, and a list of Mux playback ids. Adding a product is an entry in that list — the sales page, the player routes, the `/home` card and the access check all read from it, and `proxy.ts` derives the public-route list from it so each sales page loads signed out. `entitlement: null` marks a product free to anyone with an account (the `12 Minute Posture and Mobility Routine` lead magnet). The entitlement check runs server-side, so playback ids are never sent to a browser that isn't entitled to them. Buyers get a video library; a single-video product they own renders straight into the theater layout.
- **Bespoke sales pages** — a product can override the generic unowned view with its own long-form landing page via `CUSTOM_LANDINGS` in `(app)/[product]/page.tsx`; everything else falls through to the default layout, so a new product still needs no code changes. `Posture & Mobility Reset` (`/posture`) is the first: hero, the five classes, teacher bio, testimonials and a medical disclaimer, in its own typeface and palette (`components/products/posture-landing.tsx`, images in `public/posture/`, design canvas in [`design/posture-and-mobility-reset`](./design/posture-and-mobility-reset/README.md)). It never quotes a price — figures come from RevenueCat through `ProductPurchase` — and it renders the lineup from `lib/products.ts` rather than restating it, so the sales copy and the delivered videos can't drift apart.
- **Marketing URLs** — a product's advertised address can differ from its slug. `/class1` (`(app)/class1/page.tsx`) is the sales page for the free routine, while the product itself stays at `/posture-routine`; the route names the slug in one constant and renders `components/products/free-class-landing.tsx`. Deliberate separation: the slug drives the player routes, the `/home` card, the proxy's derived public-route list and the `source:<slug>` Mailchimp tag, so pinning the ad URL to it would mean a rename breaks links and splits signup attribution. Signed-in visitors are redirected to the class — it's free to anyone with an account, so there's nothing to sell them. Add any new marketing URL to `proxy.ts`, or the proxy 307s it to `/sign-in`.
- **Free-membership signup** — a hidden, unlisted page (`/join/[code]`, gated by the `JOIN_SECRET_SLUG` env var) where a user signs up via Clerk and is granted a **lifetime "Move Mindful Pro" promotional entitlement** server-side through RevenueCat's REST API (`REVENUECAT_SECRET_API_KEY`), then lands on `/home`. Protected by URL obscurity only — anyone with the link can self-enroll.

**Marketing integrations and account lifecycle**

- **Mailchimp audience sync** — two webhook receivers keep the marketing audience in step with who someone is. Clerk's (`/api/webhooks/clerk`, Svix-signature verified) adds new users on `user.created` with `signup` and, when they signed up from a product's page, `source:<slug>` — a stronger signal than it looks, since the only thing that sends a signed-out visitor to sign-up is a buy button. RevenueCat's (`/api/webhooks/revenuecat`, shared secret via `REVENUECAT_WEBHOOK_AUTH`) **reconciles rather than records**: on any event it asks RevenueCat what the customer holds now and sets every `purchased:<slug>` tag (plus `member`) to match, so refunds, expiries, transfers and dashboard revocations all work without enumerating event types, and retries or replays converge instead of corrupting. Emails come from Clerk, the source of truth, rather than RevenueCat's `$email` copy. The full tag vocabulary lives in `lib/audience-tags.ts`. Both receivers must be listed in `proxy.ts` — anything a machine calls is otherwise redirected to `/sign-in`, which a sender reports as a delivery failure rather than an auth error.
- **ManyChat tag sync** — the same two receivers mirror `signup` and `purchased:<slug>` into ManyChat (`MANYCHAT_API_TOKEN`), so a DM flow can branch on whether someone already has an account or already bought. Deliberately the same tag vocabulary as Mailchimp rather than a second dialect. ManyChat identifies people by contact id and the site by Clerk user, so the two are joined by carrying an identifier across: a ManyChat link appends `?mc={{contact_id}}`, `proxy.ts` stashes it in a 30-day first-party cookie (the buy button rebuilds the sign-up URL from the slug and drops the query string), sign-up puts it in `unsafeMetadata` — the only channel Clerk's `<SignUp>` offers — and `user.created` promotes it to `privateMetadata`, since the client-writable copy shouldn't be the durable one. Matching on email was rejected: Instagram supplies none. Unlike the Mailchimp calls beside them, both receivers ask for a retry when ManyChat fails — a missed newsletter tag costs a newsletter, a missed `signup` tag makes a flow believe a customer never signed up. `lib/manychat.ts` hardcodes both endpoint paths and takes none from a caller: `/fb/page/removeTagByName` is one segment from the subscriber form and deletes the tag account-wide. See [manychat.md](./manychat.md) for the flow design, and [Paytest.md](./Paytest.md) for the end-to-end test that's still to run.
- **Customer names in RevenueCat** — the Clerk webhook mirrors each user's name and email onto their RevenueCat customer on `user.created` and `user.updated`: `$displayName` and `$email` (RevenueCat's reserved attributes) plus custom `first_name` and `last_name`, so a buyer is named in the dashboard from signup. `scripts/backfill-revenuecat-names.mjs` does the same for existing users — a dry run by default, `--apply` to write; set `CLERK_SECRET_KEY` to the live key for the one command to target production, since `.env.local` holds the development one.
- **Account deletion cleanup** — on `user.deleted`, the Clerk webhook removes the member's rows from the database (`workout_sessions`, `member_preferences`, `user_profiles`) via `lib/member/delete-server.ts`; a failure answers 500 so Clerk retries. Third-party copies (Mailchimp, ManyChat, RevenueCat) and any active subscription are not touched — deleting an account does **not** cancel billing.
- **Clerk webhook events** — the endpoint must be subscribed to `user.created`, `user.updated` and `user.deleted` in the Clerk dashboard.

**Member experience**

- **Home** (`/home`) — the signed-in root (distinct from `/`, the public marketing page). Every entry point lands here: the homepage redirect, the `/join` grant, the PWA `start_url`, and Clerk's `AFTER_SIGN_IN_URL`. Lists every product with an owned/locked badge, linking through to the video library or the sales page. The class library joins it when the membership returns.
- **Member browse** (`/classes`) — curated **collection carousels** (manual + smart, ordered, each capped at its display limit); class card/detail metadata derived from tags (Discipline label · Intensity badge · Focus/Vibe chips) plus the admin class date, with the instructor's avatar + name (single-initial fallback). Curation-only: a class appears only if it's in a published collection. Class pages (`/classes/[id]`) use `@mux/mux-player-react` (adaptive streaming, AirPlay) on a full-width theater stage.
- **Live** (`/live`) — a persistent full-width Mux live stream (`streamType="live"`, playback id via `NEXT_PUBLIC_MUX_LIVESTREAM_PLAYBACK_ID`) that polls a protected `/api/live/status` route for Mux's active-stream state, starts muted playback automatically when the stream goes live, shows a viewer-local "next class" countdown (Luxon), and renders a hardcoded recurring weekly schedule as a month calendar (class times defined in Arizona time, shown in the viewer's timezone).
- **Workouts** (Phase 4.5):
  - **Where** — `/workouts` lists them; each card shows "Resume · N%" (with a bar along the cover) or "Done · 3 days ago". `/workouts/[id]` is the preview and the player, in the `(player)` route group (full screen, no site header). **`/demo1`** is a public, unindexed sample that plays one pinned workout while it's published; signed-out visitors get the first-run guide every time they begin.
  - **Preview** — a "✓ Done · 3 days ago" pill once the member has finished it (the same label as the cards; updates as soon as they finish), time, "You'll need" (one pill per dumbbell level) and the whole sequence (the cool-down last, marked Optional), with **Begin workout** and a Warm-up switch — or, with saved progress, **Resume · N% complete** and **Start over**. The cover becomes a silent exercise montage on every workout (including `/demo1`): three seconds per distinct exercise in sequence order, using its first side, with soft fades and a pause/play button. Each exercise appears once per montage cycle, regardless of repeated sets, circuits, supersets or left/right sides. Short clips loop to fill three seconds; a single exercise loops continuously. Only the current and next montage clips load, playback pauses when the tab or preview is hidden, and the montage is released on Begin/Resume. The uploaded cover (or first available exercise poster) stays visible while loading, for reduced motion, or when playback fails. Code: `components/workouts/workout-montage.tsx`.
  - **Player** — the workout's intro video (if it has one) and the optional warm-up, then the workout story-style: a segmented progress bar, a tutorial before each new exercise (Loop / Play once / Off), a 6-second **Get ready** countdown before an exercise starts (skipped when a rest has just counted down into another set of the same exercise; a rest into a different exercise still gets ready), rep and timed sets, sides, supersets and circuits, rests with a countdown ring, a pause screen, End workout and a summary (its Done, like End workout, returns to the workout's preview). After the last exercise, a workout with a cool-down asks **"Cool down?"** (Yes, cool down / No thanks — there's no switch for it up front), then the outro video (if it has one) plays before the summary. The intro, warm-up, cool-down and outro all play the same way: one video start to finish, with its own progress bar and a Skip that fills as it plays; a restart doesn't replay the intro. Signed-in members rate the workout out of five stars on the summary — one rating per member per workout, changed by tapping again (`workout_ratings`, `app/actions/workout-ratings.ts`). Pausing on a rest or Get ready holds its countdown right there (Pause becomes Resume) rather than opening the pause screen. **Audio tips**: a set or rest with one plays the instructor's recording a moment in (3 s into the exercise, 1 s into a rest) while their profile photo slides in at the bottom right, ringed by equalizer bars (`components/workouts/coach-tip.tsx`); pausing holds it mid-word — the photo stays put, bars still, and carries on with the voice on Resume rather than sliding in again — it stops when the set or rest ends and never plays with instructor audio off.
  - **Controls** — on phones: tap the left or right side to go back or on, the middle to pause (or hold) — on the intro, warm-up, cool-down or outro, right skips it and left asks "Restart the warm-up?" (or intro, cool-down, outro); swipe up for the workout overview; swipe down to minimize the controls, up to bring them back. The pause screen offers Restart this set (Restart tutorial while a tutorial plays, replaying it) and Restart workout (from the warm-up when it's on). A first-run guide explains them (and the audio button's Audio card, and that Bluetooth headphones work) and ends on how the member's tutorials and auto-advance are set, with Change settings or "Let's go!"; ✕ or Skip closes it from any page (replayable from Settings). Wide landscape screens get the desktop "theater" layout (the `theater` Tailwind variant in `globals.css`) with on-screen buttons, plus Space, the arrow keys and Esc — and their own first-run guide, a four-page dialog (`components/workouts/desktop-guide.tsx`), remembered separately from the phone one.
  - **Audio** — the sound button (phones: bottom left, and top left on the pause screens — opposite Settings; desktop: in the button column) opens an Audio card — which doesn't pause anything: the workout, its countdowns, videos and tips carry on under it, and it stays open as sets change — with **Music** (one long track looped under the workout — the file and every level are in `components/workouts/music.ts`: its normal volume, how far it dips under tutorials, tips, the intro and outro, through the warm-up and cool-down, on the summary (it plays on until Done) and — switched off for now with `MUSIC.whilePaused` — quietly while the workout's paused (otherwise pausing stops it; it always stops when the page is hidden); fades move evenly in loudness; it goes through Web Audio, since iPhone Safari ignores an element's volume; pausing pauses it), **Sound effects** (the Up next chime, `public/audio/upnext.mp3`, as an Up next card slides in ten seconds before a set that ends by itself — timed, or reps on auto-advance; not the workout's last — ends (`UP_NEXT`, `components/workouts/up-next-card.tsx`); and the 3-second countdown over the last seconds of a rest or Get ready — `public/audio/countdown.m4a`, timed by `COUNTDOWN` in `components/workouts/cue-audio.ts` so its counts land on 3, 2, 1 and it ends with the rest; the music doesn't dip for it), **Audio tips** and, at the bottom, **Mute all** (silences the tutorials, intro, warm-up, cool-down, outro and tips; the switches above dim while it's on). **Keep my music playing** (mixing with other apps' audio via the Audio Session API, Safari and Firefox) is built but hidden — and off — for user testing, which plays our own sample music instead: `KEEP_MY_MUSIC` in `workout-player.tsx` brings it back.
  - **Settings** — tutorial mode and **auto-advance** (rep sets move on once the reps' time at the demo's pace is up; Loop tutorials become Play once while it's on — also switchable from the **AUTO › ON/OFF** pill on the pause screen). Saved to the member's account (`member_preferences`, via `lib/member/preferences*.ts` and `app/actions/preferences.ts`) with a copy on the device — which is all a signed-out `/demo1` visitor gets.
  - **Progress** — signed in (on `/demo1` too), each workout is a session in `workout_sessions`, saved as it goes: created on Begin, updated at every new set, completed as the last exercise ends (the cool-down and outro are extras, so leaving during them still counts as done). So Resume survives a closed page — for 7 days from the last save (`RESUME_WINDOW_MS`), after which the workout starts fresh. Resume picks up at the start of the set they were on, skipping the warm-up and tutorials already shown. End workout offers Save progress / Discard progress. A saved spot is dropped if the workout's sequence is edited underneath it (`sequenceKey`). Server side: `lib/member/sessions*.ts` and `app/actions/workout-sessions.ts`.
  - **Playback** — clips play as MP4 static renditions from a fixed pool of four `<video>` elements (`components/workouts/video-pool.tsx`), unlocked for sound on the Begin tap; exercise loops always play muted; a spinner shows while a clip buffers; the screen stays awake and the workout pauses when the tab is hidden. Member reads use the service-role client after the gate (`lib/workouts/member.ts`).
- **Account Settings** (`/account`) — plan status and profile; profile edits and password changes open Clerk's account window.
- **Help** (`/help`) — contact page (email link).
- **Navigation** — the header carries the logo, the section links (from tablet width up) and the user menu: profile photo and email, **Admin** for admins, Account Settings, Help and Sign out. On phones the section links move to a floating, frosted iOS-style **tab bar** along the bottom (`components/tab-bar.tsx`): Home and Account for everyone signed in, plus Classes, Live and Workouts for admins while those sections are locked.
- **Loading states** — every page in the `(app)`, `(player)` and `/admin` groups has a `loading.tsx` placeholder. The pages render per request (they depend on who's signed in), and without one Next.js can neither prefetch them nor move on until the server finishes — taps would look ignored.
- **Two-tier route groups** — `(app)` is the signed-in shell (header, user menu, tab bar), requiring an account but **no** entitlement, so free signups and one-time-product buyers can reach `/home`, `/account` and `/help`. `(app)/(member)` nests inside it and adds a server-side membership check for the membership-only routes (`/classes`, `/live`), inheriting the header rather than duplicating it.
- **Installable web app (PWA)** — a web manifest (`src/app/manifest.ts`) plus `appleWebApp` metadata make the site installable to the iOS/Android home screen as a standalone app. `display: "standalone"` launches it chrome-less to `MEMBER_HOME`, and `scope: "/"` keeps same-origin navigation inside the standalone window. The proxy matcher already leaves `/manifest.webmanifest` public.

**Admin CMS** (`/admin`, admin-only — opens on Exercises)

- **Exercises** (`/admin/exercises`) — the library of short vertical clips workouts are built from. Upload an exercise (tutorial + loop, or right and left loops when it's done on each side, with reps-in-clip for the pace) or a warm-up or cool-down (one video each, with their own tabs); each clip is a Mux direct upload with 1080p/720p MP4 static renditions. Clip status is synced from Mux on page load (no webhooks), and a replaced clip stays live until its replacement is ready. Archive/restore, and delete once no workout uses it ("used in N workouts"). Equipment, dumbbell levels, an optional intensity (plain 1–4, no labels; shown as a four-bar meter on each row), "Pairs well with" (other exercises that suit a superset or circuit with it — a search box with the picks listed below; pairings go both ways), and admin-only exercise tags (a flat list, separate from class tags) with a manage-tags panel. Every row has its own **Edit** link.
- **Workouts** (`/admin/workouts`) — each row shows the members' rating (★ 4.6 (12)), with a Highest rated sort alongside Recently edited, plus Preview, Edit and Delete. The builder: an optional intro and outro (this workout's own videos, uploaded right in the sequence — a new workout saves first — into `workout_videos`, with the same Mux pipeline and replace-when-ready as exercise clips), an optional warm-up and cool-down (picked from the library), a level (All levels, Beginner, Intermediate or Advanced — All levels needs `020_workout_level_all.sql`), a cover image (resized in the browser, stored in the public `workout-covers` bucket), then single exercises (sets, rest between sets, reps or time, first side for sided exercises), rests, and supersets/circuits (rounds, rest between exercises and between rounds; auto-labelled Superset N / Circuit N). A group's "Add an exercise to this group" search suggests the pairings of the exercises already in it. A live time estimate from each clip's pace, a clip preview, and publish checks (every exercise needs its clips ready). The sequence saves atomically through the `save_workout_sequence` database function. **Audio tips** — the Sequence's Edit | Audio tips switch lists every set (each side), and every rest, as members meet them, each with Record (from the microphone, in Chrome or Safari — AAC, up to 60 s), play, Redo and remove; a tip longer than its set or rest is flagged. The silence before and after the speech is trimmed off automatically (core `speechBounds`; the file stays whole and the tip plays from its `start` to its `end`; earlier recordings are trimmed when the view opens). Recordings upload to the public `workout-tips` bucket at once and are kept when the workout is saved (`workout_blocks.tips`; unused files are cleared on later saves).
  - **Generate with AI** — a window of optional criteria (length, level, focus tags, equipment on hand, style, warm-up, anything else; blank fields are Claude's call). An admin-only server action sends Claude (`claude-opus-5-5`, via `ANTHROPIC_API_KEY`) the finished exercise library with each exercise's tags, equipment, pace, intensity and pairings, plus the published workouts written out as the house style, and gets back a JSON-schema answer shaped like the builder's sequence — exercises named from an enum, so it can only pick real ones. It goes through the same cleaning as a save (`lib/workouts/clean.ts`), gets one retry if it misses the target length by much, and fills the builder **unsaved**, with Claude's notes, Try again, Change criteria and Undo. **Edit instructions** in the window opens Claude's instructions (house style, programming approach, writing), prefilled with the default and saved for every generation in `app_settings`; the technical rules (how the player runs, the timing arithmetic, reading the brief) stay fixed and show read-only beneath. Everything before the brief (the system prompt, then the library and published workouts) is marked for Anthropic's 5-minute prompt cache, so Try again and the length retry reuse it at about a tenth of the price; token use, cache included, is logged per request (`[generate-workout] tokens`). Code: `lib/workouts/generate.ts`, prompt text in `lib/workouts/generator-prompt.ts`.
- **Classes** (`/admin/classes`) — **Upload** (batch direct-upload to Mux via signed upload URLs + `@mux/upchunk`, with per-file progress and a small concurrency cap; assets surface in Import once Mux finishes encoding); **Import** (list Mux assets → import, or **Trim & import** to clip dead air into a new Mux asset, or delete unwanted assets; live recordings stay visible but wait until Mux finalizes them); create/edit with a full player for review; a temporary Mux master MP4 download for offline editing; publish/unpublish; delete (with optional Mux asset deletion); one-click "delete raw recording" on trimmed clips once the clip is ready; instructor; an admin display date; an **Access** picker (which entitlement a class requires — `required_entitlement`, migration 008); and the collections a class belongs to, right from the form. Title edits sync back to the Mux asset's `meta.title`, so videos are searchable in the Mux dashboard.
- **Instructors** — teachers with an uploaded profile photo (square-cropped in the browser, stored in the public `instructor-avatars` bucket), one per class.
- **Tags** — tag groups + tags (create/rename/delete, cascade-safe).
- **Collections** — manual (hand-picked, drag-to-reorder via `@dnd-kit`) and smart (tag-rule membership, with the same drag ordering and "sort by date" layered on top, so newly tagged classes appear at the top automatically); publish, drag-to-reorder rows, a per-collection display limit, and an "auto-add new classes to the top" toggle (manual) that pre-selects the collection in the class form.
- All writes go through server actions using the Supabase service-role key (`server-only`), and each action checks admin itself — a server action is reachable by direct POST, so the page gate alone isn't enough.

**Data and hosting**

- **Supabase** — `user_profiles`, `classes`, `instructors`, `tags`, `tag_groups`, `class_tags`, `collections`, `collection_classes`, `collection_rule_tags`, `exercises`, `exercise_videos`, `exercise_tags`, `exercise_tag_links`, `workouts`, `workout_blocks`, `member_preferences`, `workout_sessions` — all with RLS on. The browser never writes: admin writes and member-owned data go through the server with the service-role key, taking the member from their Clerk session. The member-owned tables (`member_preferences`, `workout_sessions`) have no policies at all, so the browser can't read them either. Storage buckets: `instructor-avatars` and `workout-covers` (both public).
- **Vercel** — live at `www.movemindful.com`, auto-deploying on push to `main`. Functions run in `iad1` (Washington, D.C.), next to the Supabase database (`us-east-1`, N. Virginia). Currently on the Hobby plan — see [plan.md](./plan.md#hosting--infrastructure) for the upgrades due before launch.

## What's not yet built

- **Workouts** (Phase 4.5): which entitlement unlocks them and where they sit on `/home`; showing completion history and "time since last workout" (already recorded); tutorial captions and coaching cues; removing the playback lab (`/admin/lab/playback`) and its two test clips.
- **Posture launch loose ends** ([postureproject.md](./postureproject.md)): real copy for `/pricing`; the end-to-end sign-up → purchase → tags test ([Paytest.md](./Paytest.md)).
- 30-day challenge expiry tracking and upsell flow (the original plan; nothing currently for sale uses it)
- iOS app (Expo + React Native)
- Push notifications
- Group chat, and recording livestreams into the library (later phases per plan)

## Known tech debt / dormant code

Tracked here so it doesn't get lost. None of these affect current functionality — they're cleanup waiting on confidence or a future migration.

**Dormant / transitional database columns** (on `public.classes`):

| Column | Status | Notes |
|---|---|---|
| `instructor_name` | Transitional | Superseded by `instructor_id` + the `instructors` join (migration `004`). Still read as a fallback (`inst?.name ?? instructor_name`) but **no longer written**. Drop in a future migration once confident nothing depends on it. |
| `category`, `difficulty` | Deprecated | Replaced by the unified tags model in Phase 4. **No code references remain.** `supabase/migrations/003_drop_legacy_class_columns.sql` drops them — apply it in Supabase if it hasn't been run yet. |
| `thumbnail_url` | Dormant | Never read. Thumbnails are generated from the Mux playback id (`image.mux.com/<id>/thumbnail.webp`). The `VideoClass.thumbnailUrl` field in `packages/core` is likewise unused. |

**Dormant code and data:**

- **Admin dashboard** — `/admin` redirects to `/admin/exercises`; the original dashboard UI is parked (unrendered) in `apps/web/src/components/admin/admin-dashboard.tsx`, kept in case the `/admin` slot is repurposed. Re-route it from `apps/web/src/app/admin/page.tsx` to bring it back.
- **`packages/core` access model** — `types.ts` and `access.ts` (`UserAccess`, `Challenge`, `hasAccess()`, `shouldShowUpsell()`, …) model the old membership + 30-day-challenge world and nothing imports them. Rewrite rather than delete: it's the natural home for a shared access model once the iOS app arrives.
- **`user_profiles`** (migration `001`) — never read or written by the app; only the account-deletion cleanup touches it.
- **Playback lab** — `/admin/lab/playback` and its two Mux test clips; unlinked, and can go now that the workout player exists.

**Security trade-offs accepted for now:**

- **Mux videos are public.** Assets use `playback_policies: ["public"]`, so anyone holding a playback id can stream it. Mitigated by never sending ids to a browser that isn't entitled to them; the real fix is Mux signed playback. See [postureproject.md](./postureproject.md#mux-videos-are-public--accepted-for-now).

**Performance / cost trade-offs:**

- **Per-load Mux status fetch on the Classes overview** — the admin Classes list (`getAdminClasses`) fetches Mux encode-status for every trimmed clip that still has a `source_mux_asset_id` (to gate each row's "Delete raw" button), on every page load. Normally 0–few calls — they clear as raws are deleted — but it scales with the number of un-cleaned clips. If that grows, cache the status or move readiness to a Mux webhook that writes a status column instead of polling per render. The exercise library syncs pending clips from Mux the same way.

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
| Marketing | Mailchimp, ManyChat |
| AI | Claude API (admin: Generate with AI in the workout builder) |
| Push Notifications | Expo Notifications (planned) |

## Building AI features

Generate with AI (`apps/web/src/lib/workouts/generate.ts`) is the reference. Any new Claude feature follows the same conventions:

- **Prompt caching, always.** Order every request from stable to changing: the system prompt first, then any long context that repeats between calls (a library, examples), and the part that changes per call (the user's request) last. Mark the end of the system prompt and the end of the stable context with `cache_control: { type: "ephemeral" }`. The cache lasts 5 minutes; reads cost about a tenth of normal input, writes about a quarter more. Keep anything that varies per call (timestamps, ids, random or unstable ordering) out of the cached part: one changed character invalidates everything after it, so build cached text from deterministically ordered data.
- **Log token use** on every request, cache reads and writes included (like `[generate-workout] tokens: …`), so cost shows up in Vercel's logs.
- **Server-only, behind auth.** Claude is called from server actions or route handlers after the right check (`requireAdmin()` for admin tools, the Clerk session for members). `ANTHROPIC_API_KEY` never gets a `NEXT_PUBLIC_` prefix.
- **Structured output when the answer drives the UI:** a JSON schema in `output_config.format`, with enums for anything that must match real data (like exercise keys), and the result re-validated on the server like any other input.
- **Bounded time.** `maxDuration` on the page, a `timeout` on each request inside it, and plain-language errors for timeouts, rate limits and overload.
- **One model constant per feature** (currently `claude-opus-5-5`), so switching models is a one-line change.

## Project Structure

```
move-mindful/
├── apps/
│   ├── web/                    # Next.js 16 + Tailwind CSS v4
│   │   ├── .env.example        # Every environment variable, with notes
│   │   ├── scripts/            # One-off maintenance: RevenueCat name backfill, Mux upload/clip/delete helpers
│   │   └── src/
│   │       ├── proxy.ts        # Clerk middleware: public routes, optimistic admin/section redirects, ManyChat cookie
│   │       ├── lib/            # supabase/, mux/, auth/ (admin, viewer access, section locks), admin/, exercises/,
│   │       │                   # workouts/, member/ (preferences, sessions, account deletion), products, entitlements,
│   │       │                   # revenuecat(-admin), mailchimp, manychat, audience-tags, routes
│   │       ├── components/     # user menu, tab bar, Mux player, carousels, products/*, admin/*, workouts/* (the player), live/*
│   │       └── app/            # App Router
│   │           ├── page.tsx         # Public landing (redirects signed-in → /home)
│   │           ├── pricing/         # Pricing page (RevenueCat offerings + purchase)
│   │           ├── sign-in/, sign-up/  # Clerk <SignIn /> / <SignUp />
│   │           ├── join/[code]/     # Hidden free-membership signup (env-gated, lifetime grant)
│   │           ├── api/             # webhooks/clerk, webhooks/revenuecat, live/status
│   │           ├── actions/         # Server actions: classes, uploads, tags, collections, instructors,
│   │           │                    # exercises, workouts, preferences, workout-sessions
│   │           ├── admin/           # Admin CMS: exercises, workouts, classes, instructors, tags, collections
│   │           ├── (app)/           # Signed-in shell (no entitlement): home, account, help, workouts list, class1
│   │           ├── (app)/[product]/ # One-time products: public sales page + gated player
│   │           ├── (app)/(member)/  # Membership-gated: classes, classes/[id], live
│   │           └── (player)/        # Full screen, no header: workouts/[id], demo1
│   └── mobile/                 # Expo 56 / React Native (starter screen)
├── packages/
│   └── core/src/               # Shared TypeScript (see "Monorepo" above)
│       ├── workouts.ts, workout-player.ts, workout-progress.ts   # + *.test.ts
│       ├── types.ts, access.ts # Original access model (unused)
│       └── index.ts            # Re-exports
├── supabase/migrations/        # Numbered SQL, applied by hand in the Supabase SQL Editor (001 → 019)
├── design/                     # Design canvas mirrors; each folder's README links its online canvas
├── plan.md                     # Architecture, build order, hosting, security guidelines
├── postureproject.md           # The pivot to one-time products: decisions, launch to-dos, flagged risks
├── manychat.md                 # ManyChat integration: API notes, tag vocabulary, flow design
├── Paytest.md                  # Manual end-to-end test: ManyChat link → sign-up → purchase → tags
├── phase-4-plan.md             # Historical: the approved Phase 4 implementation plan
├── TODO.md                     # Running marketing/product to-do list
├── CLAUDE.md                   # Instructions for AI coding agents (AGENTS.md is a symlink to it)
├── turbo.json                  # Turborepo task config
├── tsconfig.base.json          # Shared TypeScript compiler options
└── package.json                # Root workspace config
```

Migrations: 001 schema · 002 media organization · 003 drop legacy class columns · 004 instructors · 005 collection auto-add + limit · 006 clip source tracking · 007 class date · 008 class access · 009 exercises · 010 workouts · 011 set rest + workout cover · 012 member preferences · 013 workout sessions · 014 exercise intensity · 015 app settings · 016 exercise pairings · 017 workout ratings · 018 intro, outro and cool-down · 019 workout audio tips.

## Getting Started

### Prerequisites

- Node.js 20+
- npm 11+

### Install dependencies

```bash
npm install
```

### Environment variables

The web app needs Clerk, Supabase, RevenueCat, Mux, Mailchimp, ManyChat and Anthropic keys, plus a few shared secrets. `apps/web/.env.example` lists every variable with a note on where it comes from. Copy it and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

`.env.local` is gitignored; never commit real keys, and never give a secret a `NEXT_PUBLIC_` prefix (those are sent to the browser).

> **Purchases are real in every environment.** Vercel and the default `.env.local` both hold RevenueCat's
> production Web Billing key, so a test purchase — even on localhost — is a live Stripe charge. For free test
> purchases, put the **sandbox** key (`rcb_sb_…`, from RevenueCat → Apps & Providers → the web configuration) in
> `.env.local` and test against `npm run dev:web`. Leave Vercel on the production key.

### Database

Migrations are numbered SQL files in `supabase/migrations/`. Apply each one, in order, in the Supabase SQL Editor — there's no migration runner. New code should cope with its migration not having been applied yet (reads come back empty rather than crashing).

### Development

```bash
# Run everything (web + mobile + core)
npm run dev

# Run just the web app (http://localhost:3000)
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

### Lint and typecheck

```bash
npm run lint
npx tsc --noEmit -p apps/web
```

### Test

The shared workout model — estimate, player steps, the player's state machine and saved progress — has unit tests (Node's built-in test runner, no extra dependencies):

```bash
npm test -w @move-mindful/core
```

## Docs

- [plan.md](./plan.md) — tech stack rationale, business model, purchasing strategy, the build order (Phases 1–8, plus 4.5), hosting and costs, security guidelines
- [postureproject.md](./postureproject.md) — the pivot to one-time products: what was decided, what's left to launch, what's flagged
- [manychat.md](./manychat.md) — the ManyChat integration and DM flow design; [Paytest.md](./Paytest.md) — its end-to-end test
- [design/](./design/) — mirrors of the design canvases, each with a README linking the live canvas
- [phase-4-plan.md](./phase-4-plan.md) — historical record of the Phase 4 (admin CMS) plan
- [CLAUDE.md](./CLAUDE.md) — working rules for AI coding agents (`AGENTS.md` links to it)
