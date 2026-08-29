/**
 * Shared route constants.
 *
 * Framework- and SDK-free so both client and server code can import this
 * (same reasoning as `lib/entitlements.ts`).
 */

/**
 * Where a signed-in member lands.
 *
 * The on-demand class library (`/classes`) and the live stream (`/live`) are
 * built but not released — they're locked to admins while the one-time-purchase
 * product is the only thing on sale (see `lib/auth/locked-sections.ts`). So the
 * homepage redirect, the PWA start URL, and the post-signup `/join` grant all
 * point here instead of at `/classes`.
 *
 * When the membership launches, point this back at "/classes" and set
 * NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL to match.
 */
export const MEMBER_HOME = "/account";
