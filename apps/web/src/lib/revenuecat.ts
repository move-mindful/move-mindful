"use client";

import { Purchases } from "@revenuecat/purchases-js";

export const ENTITLEMENT_ID = "Move Mindful Pro";

export function configurePurchases(appUserId: string): Purchases {
  try {
    return Purchases.getSharedInstance();
  } catch {
    return Purchases.configure(
      process.env.NEXT_PUBLIC_REVENUECAT_API_KEY!,
      appUserId,
    );
  }
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
