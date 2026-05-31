# WeightsApp — Project Plan

## Overview

A video fitness platform offering on-demand classes, live streaming, group chat, and push notifications. Web and iOS are co-equal platforms. All purchases happen on the web; the iOS app is the logged-in experience.

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
| Chat               | TBD (not at launch)           | Group chat — evaluate when needed (see below) |
| Push Notifications | Expo Notifications            | iOS push notifications                       |
| Web Hosting        | Vercel                        | Next.js hosting, serverless functions, CDN   |
| Backend / DB       | Supabase                      | Postgres, auth helpers, storage, realtime    |
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

### 30-Day Challenge (Entry Product)
- One-time purchase managed through RevenueCat (Stripe on web)
- Time-limited access (30 days from purchase)
- Goal: low-commitment entry point to acquire users

### Membership (Recurring)
- Monthly subscription via RevenueCat (Stripe on web, Apple IAP on mobile if added later)
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

### Web = Storefront
- All purchases (challenge + membership) happen on the website
- RevenueCat manages subscriptions and one-time purchases (Stripe processes the payments)
- User never creates separate accounts — one Clerk login, RevenueCat customer linked via Clerk user ID

### iOS App = Experience
- No in-app purchases (avoids Apple's 15-30% cut)
- Users who open the app without a subscription see: "Sign up at yourwebsite.com"
- No clickable link to purchase page (Apple's anti-steering rules)
- Marketing (social media, email, search) drives users to the website to purchase

### Access Control Logic
```typescript
// RevenueCat handles this via "entitlements" — you define access levels
// in the RevenueCat dashboard and check them with one API call
const customerInfo = await Purchases.getCustomerInfo()
const hasAccess = customerInfo.entitlements.active['premium'] !== undefined
// 'premium' entitlement is granted by EITHER the challenge purchase OR the membership
// RevenueCat tracks expiry, renewal, and cross-platform status automatically
```

---

## Feature Breakdown

### 1. On-Demand Video Classes
- Hosted on Mux (HLS adaptive streaming, automatic transcoding)
- `@mux/mux-player-react` on web — polished player with controls
- `expo-video` on mobile with Mux HLS URLs
- AirPlay works automatically on Apple devices (native `<video>` / iOS)
- Chromecast: future enhancement (requires Google Cast SDK integration)

### 2. Push Notifications
- Expo Notifications handles Apple APNs setup
- Use cases: new class alerts, challenge reminders, live stream starting

### 3. Livestreaming (Phase 2)
- Mux Live for one-to-many broadcast (instructor streams, members watch)
- If interactive/bidirectional needed later: evaluate LiveKit or Agora

### 4. Group Chat (Future — not at launch)
- Not included in initial build — add when community engagement becomes a priority
- Options to evaluate when the time comes:

| Option | Cost | Pros | Cons |
|---|---|---|---|
| **Supabase Realtime** | Free (already in stack) | No extra vendor, real-time Postgres subscriptions, $0 cost | More DIY — you build the chat UI and features yourself |
| **Stream Chat** | $399/mo (Maker plan) | Best-in-class React + React Native SDKs, moderation, threads, reactions, typing indicators | Expensive — biggest line item at early stage |
| **Sendbird** | Free up to 25 MAU, then $399/mo | Similar quality to Stream, good SDKs | Same price jump |
| **PubNub** | Free up to 200 MAU | Chat SDK available, cheaper paid tiers | Less polished than Stream/Sendbird |
| **Ably** | Free up to 200 MAU | Scalable real-time infrastructure | Lower-level, more UI work required |

---

## Build Order

| Phase | What                                         | Details                                           |
|-------|----------------------------------------------|---------------------------------------------------|
| 1     | Web app foundation                           | Next.js + Clerk auth + Supabase DB                |
| 2     | Video classes on web                         | Mux integration, class catalog, player            |
| 3     | Challenge purchase flow                      | RevenueCat + Stripe, entitlements, expiry tracking |
| 4     | Membership subscription                      | RevenueCat subscription, upsell flow from challenge |
| 5     | iOS app                                      | Expo + React Native, reuse core logic/services    |
| 6     | Push notifications                           | Expo Notifications for iOS                        |
| 7     | Group chat                                   | Evaluate options above when ready                 |
| 8     | Livestreaming                                | Mux Live (bolt on last)                           |

---

## Hosting & Infrastructure

| What                  | Where it lives       | Cost                                      |
|-----------------------|----------------------|-------------------------------------------|
| Website + API routes  | Vercel               | Free (hobby) → $20/mo (pro)              |
| Database + storage    | Supabase             | Free → $25/mo (pro)                      |
| Video files + CDN     | Mux                  | Pay-per-use (included in Mux pricing)     |
| iOS app distribution  | Apple App Store      | $99/year (Apple Developer Program)        |

### Estimated Monthly Costs by Stage

| Stage | Users | Revenue | Estimated Costs | Margin |
|---|---|---|---|---|
| Launch | 0–100 | $0–1,000/mo | ~$0–50/mo | — |
| Early growth | 100–500 | $1,000–5,000/mo | ~$100–300/mo | ~90–95% |
| Growth | 500–1,000 | $5,000–10,000/mo | ~$400–700/mo | ~90–93% |
| Scale | 5,000+ | $50,000+/mo | ~$2,500–3,500/mo | ~93–95% |

**Note:** At launch, every service in the stack has a free tier. The only fixed cost is the Apple Developer Program ($99/year) when you're ready to publish the iOS app. Costs scale proportionally with revenue — you don't hit meaningful bills until you're making money.

---

## Key Decisions & Rationale

- **TypeScript everywhere** — one language across web, mobile, and backend; keeps every door open
- **React + React Native over Flutter** — Flutter's web output is weak for video-heavy apps; TS ecosystem is stronger for co-equal web + mobile
- **Monorepo over separate codebases** — share types, API client, business logic; rebuild only the UI per platform
- **Mux over Cloudflare Stream** — better React SDK, superior analytics (Mux Data), more polished livestreaming
- **Clerk for auth, RevenueCat for payments** — Clerk handles identity (who is this person?), RevenueCat handles commerce (what have they paid for?). Clean separation of concerns
- **RevenueCat over Clerk Billing** — subscriber management dashboard, cohort analytics, A/B testing, cross-platform entitlements, and seamless path to Apple IAP if needed later
- **No in-app purchases at launch** — avoids Apple's 15-30% cut; web is the storefront, app is the experience; proven model (Netflix, Spotify, Kindle). RevenueCat makes adding IAP trivial later if needed

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

**4. Stripe webhook verification**

Always verify that incoming Stripe webhooks actually came from Stripe using `stripe.webhooks.constructEvent()`. Without this, someone could fake a payment notification and get free access.

**5. Supabase Row Level Security (RLS)**

Enable RLS on every table and write policies that tie rows to Clerk user IDs. Without RLS, anyone with the Supabase public key could query the database directly from the browser.

### Security Checklist (for every new feature / AI-generated code)

- [ ] User ID is derived from Clerk session, not from URL or request body
- [ ] Clerk auth middleware is applied to the API route
- [ ] No secret keys in `NEXT_PUBLIC_` env vars or client-side code
- [ ] Stripe webhooks are verified with `constructEvent()`
- [ ] Supabase RLS policies exist for any new tables
- [ ] Ask: "What happens if a logged-in user changes the ID in this request to someone else's?"

---

## Future Considerations

- **Apple IAP via RevenueCat** — RevenueCat already supports Apple IAP; flip it on if App Store discovery becomes a meaningful acquisition channel and in-app purchase conversion justifies the Apple commission
- **Chromecast support** — requires Google Cast SDK integration, not automatic like AirPlay
- **Android app** — React Native / Expo supports Android out of the box; add when there's demand
- **Apple external purchase link entitlement** — monitor evolving App Store rules (US allows a link but Apple still takes ~27%, plus a scare screen; may improve over time)
