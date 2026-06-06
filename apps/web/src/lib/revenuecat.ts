"use client";

import { Purchases } from "@revenuecat/purchases-js";
import { ENTITLEMENT_ID } from "@/lib/entitlements";

export { ENTITLEMENT_ID };

export async function configurePurchases(
  appUserId?: string | null,
): Promise<Purchases> {
  if (Purchases.isConfigured()) {
    const instance = Purchases.getSharedInstance();
    // The SDK is a process-wide singleton, so an earlier call may have
    // configured it under a different identity — typically an anonymous shopper
    // who has since signed in. If we now have a real Clerk id that doesn't match
    // the active user, switch to it so customer info and purchases resolve
    // against the signed-in account instead of the stale anonymous one.
    // Without a real id, leave the existing instance untouched.
    if (appUserId && instance.getAppUserId() !== appUserId) {
      await instance.changeUser(appUserId);
    }
    return instance;
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
