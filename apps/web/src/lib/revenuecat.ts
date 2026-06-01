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
