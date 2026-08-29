/**
 * Shared route constants.
 *
 * Framework- and SDK-free so both client and server code can import this
 * (same reasoning as `lib/entitlements.ts`).
 */

/**
 * The signed-in root — not to be confused with "/", which is the public
 * marketing page. Every entry point lands here: the homepage redirect for
 * signed-in visitors, the `/join` grant, the PWA start URL, and Clerk's
 * NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL (keep that env var in sync).
 *
 * It sits in the `(app)` route group, which requires an account but no
 * entitlement — so it works for free-tier signups and one-time-product buyers,
 * not just members.
 */
export const MEMBER_HOME = "/home";
