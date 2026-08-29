import "server-only";

import { cache } from "react";

import { MEMBERSHIP_ENTITLEMENT } from "@/lib/entitlements";

const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";

/** One entry in `subscriber.entitlements` from GET /v1/subscribers/{id}. */
interface RevenueCatEntitlement {
  /** ISO 8601, or null for a lifetime entitlement that never expires. */
  expires_date: string | null;
  /** ISO 8601. Set while a billing retry is in flight — still entitled. */
  grace_period_expires_date?: string | null;
}

/**
 * The entitlement identifiers this customer currently holds.
 *
 * Read server-side so gated content can be filtered *before* it renders. The
 * client-side gate in `EntitlementGate` can only hide what the server already
 * sent — playback ids included — so it's a UX gate, not an access boundary.
 * This is the access boundary.
 *
 * `cache()` dedupes within a single render pass: a page that resolves a browse
 * list and then a specific class makes one RevenueCat call, not two.
 *
 * Fails **closed** — a RevenueCat outage denies access rather than granting it.
 * That's the right default for paid content, but it does mean an outage locks
 * out paying customers, so the error is logged loudly for diagnosis.
 */
export const getActiveEntitlements = cache(
  async (appUserId: string): Promise<Set<string>> => {
    const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
    if (!apiKey) {
      console.error("[entitlements] REVENUECAT_SECRET_API_KEY is not configured");
      return new Set();
    }

    let res: Response;
    try {
      res = await fetch(
        `${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          // Entitlements change on purchase and expiry; never serve a cached copy.
          cache: "no-store",
        },
      );
    } catch (error) {
      console.error("[entitlements] RevenueCat request failed", error);
      return new Set();
    }

    // 200 = existing customer, 201 = created on the fly. Both are fine; a brand
    // new customer simply holds nothing.
    if (!res.ok) {
      console.error(
        `[entitlements] RevenueCat lookup failed (${res.status})`,
        await res.text(),
      );
      return new Set();
    }

    const body = (await res.json()) as {
      subscriber?: { entitlements?: Record<string, RevenueCatEntitlement> };
    };

    const now = Date.now();
    const held = new Set<string>();
    for (const [id, ent] of Object.entries(body.subscriber?.entitlements ?? {})) {
      // A null expires_date is a lifetime grant — exactly what the /join flow
      // and the one-time products issue, so it must count as active.
      const active =
        ent.expires_date === null ||
        (ent.expires_date != null && Date.parse(ent.expires_date) > now) ||
        (ent.grace_period_expires_date != null &&
          Date.parse(ent.grace_period_expires_date) > now);
      if (active) held.add(id);
    }
    return held;
  },
);

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
    MEMBERSHIP_ENTITLEMENT,
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
