import "server-only";

import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { canAccess } from "@/lib/entitlements";
import { getActiveEntitlements } from "@/lib/revenuecat-admin";

export interface ViewerAccess {
  signedIn: boolean;
  isAdmin: boolean;
  /** RevenueCat entitlement identifiers currently held. Empty when signed out. */
  entitlements: ReadonlySet<string>;
}

/**
 * Who's watching and what they're entitled to, resolved once per render.
 *
 * The RevenueCat App User ID is the Clerk user id — the same value the client
 * SDK configures with (see `configurePurchases`) — so a grant made server-side
 * is immediately visible here and vice versa.
 */
export const getViewerAccess = cache(async (): Promise<ViewerAccess> => {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return { signedIn: false, isAdmin: false, entitlements: new Set() };
  }

  const isAdmin = sessionClaims?.metadata?.role === "admin";

  // Skip the RevenueCat round-trip for admins — they bypass content gates
  // anyway, and the admin CMS renders class lists on every page load.
  if (isAdmin) {
    return { signedIn: true, isAdmin: true, entitlements: new Set() };
  }

  return {
    signedIn: true,
    isAdmin: false,
    entitlements: await getActiveEntitlements(userId),
  };
});

/**
 * Can this viewer watch a class requiring `required` (null = free)?
 *
 * Admins pass everything so they can preview unreleased and paid content —
 * the same reasoning as the Classes/Live section lock.
 */
export function viewerCanAccess(
  viewer: ViewerAccess,
  required: string | null | undefined,
): boolean {
  if (!viewer.signedIn) return false;
  if (viewer.isAdmin) return true;
  return canAccess(required, viewer.entitlements);
}
