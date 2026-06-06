import "server-only";

import { ENTITLEMENT_ID } from "@/lib/entitlements";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";

/**
 * Grant a lifetime promotional entitlement to a RevenueCat customer.
 *
 * The customer is keyed by the Clerk user id — the same value the client SDK
 * uses as the RevenueCat App User ID (see `configurePurchases`), so the grant is
 * immediately visible to the entitlement gate. The subscriber is created first
 * (the promotional endpoint does NOT create it — see below), then granted.
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

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const subscriberUrl = `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(
    appUserId,
  )}`;

  // The promotional-grant endpoint does NOT create the subscriber — it 404s
  // ("subscriber not found") if RevenueCat has never seen this app user id. In
  // the /join flow the grant runs server-side right after sign-up, before the
  // client SDK has ever configured RevenueCat with the Clerk id, so the
  // subscriber won't exist yet. GET /subscribers is get-or-create, so call it
  // first to materialize the subscriber, then grant.
  const ensureRes = await fetch(subscriberUrl, {
    method: "GET",
    headers: authHeaders,
  });
  if (!ensureRes.ok) {
    const detail = await ensureRes.text();
    throw new Error(
      `RevenueCat subscriber lookup/create failed (${ensureRes.status}): ${detail}`,
    );
  }

  const grantUrl = `${subscriberUrl}/entitlements/${encodeURIComponent(
    ENTITLEMENT_ID,
  )}/promotional`;

  const res = await fetch(grantUrl, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ duration: "lifetime" }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `RevenueCat promotional grant failed (${res.status}): ${detail}`,
    );
  }
}
