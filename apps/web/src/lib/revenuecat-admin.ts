import "server-only";

import { ENTITLEMENT_ID } from "@/lib/entitlements";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";

/**
 * Grant a lifetime promotional entitlement to a RevenueCat customer.
 *
 * The customer is keyed by the Clerk user id — the same value the client SDK
 * uses as the RevenueCat App User ID (see `configurePurchases`), so the grant is
 * immediately visible to the entitlement gate. RevenueCat creates the subscriber
 * automatically if it doesn't exist yet.
 *
 * Server-only: this relies on the secret REST key and must never run in the
 * browser. "lifetime" promotional entitlements never expire, but can still be
 * revoked from the RevenueCat dashboard or API.
 */
export async function grantLifetimeMembership(appUserId: string): Promise<void> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    throw new Error("REVENUECAT_SECRET_API_KEY is not configured");
  }

  const url = `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(
    appUserId,
  )}/entitlements/${encodeURIComponent(ENTITLEMENT_ID)}/promotional`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ duration: "lifetime" }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `RevenueCat promotional grant failed (${res.status}): ${detail}`,
    );
  }
}
