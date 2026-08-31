import { createHash, timingSafeEqual } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { PRODUCTS } from "@/lib/products";
import { MEMBERSHIP_ENTITLEMENT } from "@/lib/entitlements";
import { getActiveEntitlements } from "@/lib/revenuecat-admin";
import { subscribeToAudience, type AudienceTag } from "@/lib/mailchimp";
import { MEMBER_TAG, purchasedTag } from "@/lib/audience-tags";

/**
 * RevenueCat webhook receiver — keeps Mailchimp's ownership tags in step with
 * what someone actually owns.
 *
 * **It reconciles rather than records.** Whatever event arrives, this asks
 * RevenueCat what the customer holds *now* and sets every ownership tag to
 * match. It deliberately does not branch on event type, and that is the main
 * design decision here:
 *
 *  - Refunds, expiries, transfers, dashboard revocations and comps all fall out
 *    for free, without enumerating the event names that produce them.
 *  - It is idempotent. RevenueCat retries on any non-2xx, and a replayed or
 *    out-of-order event converges on the truth instead of corrupting it.
 *  - It self-heals. A window where this route was broken or misconfigured is
 *    repaired by the next event for that customer, whatever it is.
 *
 * The cost is one extra RevenueCat call per event, which at this volume is
 * nothing. Recording `type === "SOME_PURCHASE_EVENT"` would be cheaper and
 * would be wrong the first time a refund arrived under a name we didn't expect.
 *
 * Tagging is best-effort in the sense that it never blocks a purchase — the
 * purchase already happened, in another system, before this ran. But unlike the
 * Clerk receiver it *does* ask for a retry when Mailchimp fails: ownership
 * drives suppression, so a missing tag here means selling something to someone
 * who already bought it.
 */

/** Anonymous RevenueCat customers — shoppers who never signed in. */
const ANONYMOUS_PREFIX = "$RCAnonymousID:";

interface RevenueCatWebhook {
  api_version?: string;
  event?: {
    id?: string;
    type?: string;
    /** The Clerk user id — see `configurePurchases`. */
    app_user_id?: string | null;
    original_app_user_id?: string | null;
    product_id?: string | null;
    environment?: string;
  };
}

/**
 * RevenueCat does not sign its payloads. You set an arbitrary Authorization
 * header value in the dashboard and it sends that string back verbatim, so this
 * is a shared bearer secret and nothing more — no signature, no timestamp, no
 * replay protection. Keep REVENUECAT_WEBHOOK_AUTH long and random.
 *
 * Hashed before comparing so the buffers are always the same length, which is
 * what timingSafeEqual requires — and so the comparison doesn't leak the
 * secret's length.
 */
function secretsMatch(received: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(received).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export async function POST(request: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) {
    console.error("[rc-webhook] REVENUECAT_WEBHOOK_AUTH is not set");
    // 500 so RevenueCat retries once this is configured, rather than treating a
    // dropped purchase as delivered.
    return new Response("Not configured", { status: 500 });
  }

  const provided = request.headers.get("authorization");
  if (!provided || !secretsMatch(provided, expected)) {
    console.error("[rc-webhook] rejected: bad or missing Authorization header");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: RevenueCatWebhook;
  try {
    payload = (await request.json()) as RevenueCatWebhook;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = payload.event;
  if (!event) {
    console.warn("[rc-webhook] no event in payload");
    return new Response("No event", { status: 200 });
  }

  const type = event.type ?? "UNKNOWN";

  // Test events from the dashboard, and anything from the sandbox, must not
  // touch the live audience. Logged whole, because this is exactly how you
  // confirm the real payload shape before trusting it.
  if (type === "TEST" || event.environment === "SANDBOX") {
    console.log(
      `[rc-webhook] ${type} (${event.environment ?? "no environment"}) — not applied. Payload:`,
      JSON.stringify(payload),
    );
    return new Response("OK (not applied)", { status: 200 });
  }

  const appUserId = event.app_user_id ?? event.original_app_user_id;
  if (!appUserId) {
    console.warn(`[rc-webhook] ${type} with no app_user_id`);
    return new Response("No app user id", { status: 200 });
  }

  // Someone who bought without ever signing in. There is no Clerk account and
  // therefore no email to tag — and the purchase itself is unreachable to them,
  // which is a different problem than this route can solve.
  if (appUserId.startsWith(ANONYMOUS_PREFIX)) {
    console.warn(`[rc-webhook] ${type} for an anonymous customer — skipping`);
    return new Response("Anonymous customer", { status: 200 });
  }

  // Clerk is the source of truth for the email. RevenueCat may carry one in
  // `subscriber_attributes.$email`, but only if setAttributes has run — which
  // happens on gated content, not on a sales page. A first-time buyer who came
  // straight from an ad has never hit a gate, so that attribute is routinely
  // absent exactly when it matters.
  let email: string | undefined;
  let firstName: string | null = null;
  let lastName: string | null = null;
  try {
    const user = await (await clerkClient()).users.getUser(appUserId);
    email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    firstName = user.firstName;
    lastName = user.lastName;
  } catch (error) {
    // A deleted account, or an app user id that was never a Clerk id. Nothing
    // to reconcile and nothing a retry would fix.
    console.error(`[rc-webhook] Clerk lookup failed for ${appUserId}`, error);
    return new Response("No such user", { status: 200 });
  }

  if (!email) {
    console.warn(`[rc-webhook] Clerk user ${appUserId} has no email address`);
    return new Response("No email", { status: 200 });
  }

  const held = await getActiveEntitlements(appUserId);

  // Every ownership tag, set to whatever is true right now. Free products carry
  // no entitlement, so there is no purchase to record for them.
  const tags: AudienceTag[] = PRODUCTS.filter(
    (product) => product.entitlement !== null,
  ).map((product) => ({
    name: purchasedTag(product.slug),
    active: held.has(product.entitlement as string),
  }));

  tags.push({ name: MEMBER_TAG, active: held.has(MEMBERSHIP_ENTITLEMENT) });

  const applied = tags
    .filter((t) => t.active)
    .map((t) => t.name)
    .join(", ");
  console.log(
    `[rc-webhook] ${type} · ${appUserId} · now holds: ${applied || "nothing"}`,
  );

  const ok = await subscribeToAudience({ email, firstName, lastName, tags });

  if (!ok) {
    // Ask for a retry. Safe because reconciling is idempotent — replaying this
    // event later produces the same result.
    return new Response("Mailchimp update failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
