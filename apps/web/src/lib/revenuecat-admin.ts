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
 * (the promotional endpoint does NOT create it — see `ensureSubscriber`), then
 * granted.
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

  // In the /join flow the grant runs server-side right after sign-up, before
  // the client SDK has ever configured RevenueCat with the Clerk id, so the
  // subscriber may not exist yet.
  await ensureSubscriber(subscriberUrl, authHeaders);

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

/**
 * Mirror a Clerk user's name and email onto their RevenueCat customer, so the
 * dashboard shows a person rather than a bare Clerk id.
 *
 * `$displayName` and `$email` are RevenueCat's reserved attributes. It has no
 * reserved first or last name, so those go in as the custom `first_name` and
 * `last_name` — custom attributes need no dashboard setup, RevenueCat creates
 * them on first write.
 *
 * Every field is sent every time, a missing one as "" (which RevenueCat treats
 * as a delete), so a name removed in Clerk is removed here too rather than left
 * stale. Idempotent, so safe to retry and to replay.
 */
export async function syncCustomerAttributes(
  appUserId: string,
  user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
): Promise<void> {
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

  // A brand new signup has no RevenueCat customer until something creates one.
  await ensureSubscriber(subscriberUrl, authHeaders);

  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  const values: Record<string, string> = {
    $displayName: [firstName, lastName].filter(Boolean).join(" "),
    $email: user.email?.trim() ?? "",
    first_name: firstName,
    last_name: lastName,
  };

  const res = await fetch(`${subscriberUrl}/attributes`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      attributes: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, { value }]),
      ),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `RevenueCat attribute update failed (${res.status}): ${detail}`,
    );
  }
}

/**
 * Make sure RevenueCat has a customer for this app user id.
 *
 * Write endpoints can't be relied on to create one: the promotional grant 404s
 * ("subscriber not found") for an id RevenueCat has never seen, and the docs
 * don't say either way for attributes. GET /subscribers is get-or-create, so
 * calling it first materializes the customer; for one that already exists
 * it's a harmless read.
 */
async function ensureSubscriber(
  subscriberUrl: string,
  headers: Record<string, string>,
): Promise<void> {
  const res = await fetch(subscriberUrl, { method: "GET", headers });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `RevenueCat subscriber lookup/create failed (${res.status}): ${detail}`,
    );
  }
}
