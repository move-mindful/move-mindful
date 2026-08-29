import "server-only";

import { createHash } from "crypto";

/**
 * Mailchimp Marketing API client — just enough to add someone to the audience
 * and tag them by where they came from.
 */

/**
 * The API key carries its datacenter as a suffix ("…-us21"), and that
 * datacenter is part of the host. Deriving it beats a second env var that can
 * drift out of sync with the key.
 */
function apiBase(apiKey: string): string {
  const dc = apiKey.split("-")[1];
  if (!dc) throw new Error("MAILCHIMP_API_KEY is missing its datacenter suffix");
  return `https://${dc}.api.mailchimp.com/3.0`;
}

/** Mailchimp addresses members by the MD5 of the lowercased email. */
function subscriberHash(email: string): string {
  return createHash("md5").update(email.trim().toLowerCase()).digest("hex");
}

export interface SubscribeParams {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  /** Where they came from, e.g. the product slug they signed up on. */
  tags?: string[];
}

/**
 * Add or update someone in the audience, then apply tags.
 *
 * Uses `status_if_new` rather than `status` deliberately: that only sets a
 * status when creating a member, so someone who previously unsubscribed stays
 * unsubscribed instead of being quietly resurrected. Silently resubscribing
 * people is how senders earn spam complaints and lose an audience.
 *
 * Returns false rather than throwing — a marketing-list failure should never
 * take down the signup flow that triggered it.
 */
export async function subscribeToAudience({
  email,
  firstName,
  lastName,
  tags = [],
}: SubscribeParams): Promise<boolean> {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.warn("[mailchimp] not configured — skipping subscribe");
    return false;
  }

  const base = apiBase(apiKey);
  const hash = subscriberHash(email);
  // Mailchimp uses HTTP Basic; the username is ignored.
  const auth = `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  try {
    const upsert = await fetch(`${base}/lists/${audienceId}/members/${hash}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        email_address: email,
        status_if_new: "subscribed",
        merge_fields: {
          ...(firstName ? { FNAME: firstName } : {}),
          ...(lastName ? { LNAME: lastName } : {}),
        },
      }),
    });

    if (!upsert.ok) {
      console.error(
        `[mailchimp] upsert failed (${upsert.status})`,
        await upsert.text(),
      );
      return false;
    }

    if (tags.length > 0) {
      // Tags are a separate endpoint — the upsert above only applies them on
      // creation, so an existing member would otherwise never get the new tag.
      const tagRes = await fetch(
        `${base}/lists/${audienceId}/members/${hash}/tags`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            tags: tags.map((name) => ({ name, status: "active" })),
          }),
        },
      );
      if (!tagRes.ok) {
        console.error(
          `[mailchimp] tagging failed (${tagRes.status})`,
          await tagRes.text(),
        );
      }
    }

    return true;
  } catch (error) {
    console.error("[mailchimp] request failed", error);
    return false;
  }
}
