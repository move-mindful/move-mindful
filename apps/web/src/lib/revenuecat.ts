"use client";

import { Purchases } from "@revenuecat/purchases-js";
import { ENTITLEMENT_ID } from "@/lib/entitlements";

export { ENTITLEMENT_ID };

export function configurePurchases(appUserId?: string | null): Purchases {
  if (Purchases.isConfigured()) {
    return Purchases.getSharedInstance();
  }
  // Logged-out visitors get an anonymous ID so we can fetch and display
  // offerings/prices. A real Clerk ID is only required to make a purchase.
  return Purchases.configure(
    process.env.NEXT_PUBLIC_REVENUECAT_API_KEY!,
    appUserId ?? Purchases.generateRevenueCatAnonymousAppUserId(),
  );
}

export async function syncUserAttributes(
  purchases: Purchases,
  user: { fullName?: string | null; primaryEmailAddress?: { emailAddress: string } | null },
) {
  const attrs: Record<string, string | null> = {};
  if (user.fullName) attrs["$displayName"] = user.fullName;
  if (user.primaryEmailAddress?.emailAddress)
    attrs["$email"] = user.primaryEmailAddress.emailAddress;
  if (Object.keys(attrs).length > 0) {
    await purchases.setAttributes(attrs);
  }
}
