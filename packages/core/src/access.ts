/**
 * Access control helpers — shared across web and mobile
 *
 * RevenueCat manages entitlements, but these helpers provide
 * consistent access-checking logic across both platforms.
 */

import type { UserAccess } from "./types";

/**
 * Check if a user has access to premium content.
 * True if they have an active membership OR an active challenge.
 */
export function hasAccess(access: UserAccess): boolean {
  return access.membership === "active" || access.challenge.status === "active";
}

/**
 * Check if a user's challenge is expiring soon (within N days).
 * Used to trigger upsell prompts.
 */
export function isChallengeExpiringSoon(
  access: UserAccess,
  withinDays: number = 5
): boolean {
  if (access.challenge.status !== "active" || !access.challenge.expiresAt) {
    return false;
  }

  const now = new Date();
  const msUntilExpiry = access.challenge.expiresAt.getTime() - now.getTime();
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

  return daysUntilExpiry <= withinDays && daysUntilExpiry > 0;
}

/**
 * Check if a user should see the membership upsell.
 * True if they have no membership and their challenge is expiring or expired.
 */
export function shouldShowUpsell(access: UserAccess): boolean {
  if (access.membership === "active") return false;

  return (
    access.challenge.status === "expired" ||
    isChallengeExpiringSoon(access)
  );
}
