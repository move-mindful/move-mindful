import "server-only";

/**
 * ManyChat API client — just enough to keep one contact's tags in step with
 * what the site knows about them.
 *
 * Tags are how a ManyChat flow branches: "did they make an account?", "did they
 * buy?" are both tag checks. Nothing else here is needed, and deliberately so —
 * this client cannot message anyone.
 *
 * Every path is prefixed `/fb/` whatever the channel. That is historical
 * naming, not a Messenger-only restriction: Instagram contacts go through the
 * same endpoints.
 */

const BASE = "https://api.manychat.com";

/**
 * The two endpoints, hardcoded and deliberately not parameterised.
 *
 * `/fb/page/removeTagByName` is one path segment away from the second of these
 * and does something entirely different: it deletes the tag from the whole
 * account, for every contact, irreversibly. Nothing in this module accepts a
 * path from a caller, so there is no way to reach it by getting an argument
 * wrong.
 */
const ADD_TAG_PATH = "/fb/subscriber/addTagByName";
const REMOVE_TAG_PATH = "/fb/subscriber/removeTagByName";

/**
 * A tag to apply or remove.
 *
 * Deliberately the same shape as Mailchimp's `AudienceTag`, so a caller that
 * reconciles ownership builds the list once and hands the same array to both
 * systems rather than maintaining two notions of who holds what.
 */
export interface ContactTag {
  name: string;
  active: boolean;
}

/**
 * ManyChat returns structured errors, so read `details.messages[]` rather than
 * string-matching on `message`:
 *
 *   { "status": "error", "message": "Validation error",
 *     "details": { "messages": [{ "message": "subscriber_id cannot be blank." }] } }
 */
async function describeFailure(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as {
      message?: string;
      details?: { messages?: Array<{ message?: string }> };
    };
    const messages = parsed.details?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
      return messages.map((m) => m.message ?? JSON.stringify(m)).join("; ");
    }
    return parsed.message ?? body;
  } catch {
    return body;
  }
}

/**
 * Bring one contact's tags in line with `tags`.
 *
 * Add and remove are separate endpoints in ManyChat — there is no single
 * reconcile call as there is in Mailchimp — so this walks the list and issues
 * one request per tag. Sequential rather than concurrent: the write endpoints
 * are capped at 10 requests/second, and at two or three tags per event there is
 * nothing to gain from a burst.
 *
 * Returns false rather than throwing, matching `lib/mailchimp.ts`: a marketing
 * failure should never take down the flow that triggered it. A caller that can
 * usefully retry (a webhook) should treat false as "try again later".
 *
 * A bare string is shorthand for applying that tag.
 */
export async function syncContactTags(
  contactId: string,
  tags: Array<string | ContactTag>,
): Promise<boolean> {
  const token = process.env.MANYCHAT_API_TOKEN;
  if (!token) {
    console.warn("[manychat] MANYCHAT_API_TOKEN is not set — skipping tag sync");
    return false;
  }
  if (tags.length === 0) return true;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  let ok = true;

  for (const entry of tags) {
    const tag: ContactTag =
      typeof entry === "string" ? { name: entry, active: true } : entry;
    const path = tag.active ? ADD_TAG_PATH : REMOVE_TAG_PATH;

    try {
      const response = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subscriber_id: contactId,
          tag_name: tag.name,
        }),
      });

      if (response.ok) continue;

      const detail = await describeFailure(response);

      // Removing a tag the contact was never given may be a no-op or may be a
      // validation error — unconfirmed against the live API at the time of
      // writing. Because the reconcile below asks for every unowned tag to be
      // absent on every event, that case is the common one, not the rare one.
      //
      // A 400 on a removal is therefore not treated as a failure: the tag is
      // already absent, which is what was being asked for. Every other status
      // (401, 429, 5xx) still fails, so a bad token or a rate limit can't hide
      // here. The warning is distinct so the first real events settle the
      // question from the logs.
      if (!tag.active && response.status === 400) {
        console.warn(
          `[manychat] remove "${tag.name}" for ${contactId} returned 400 — treating as already absent: ${detail}`,
        );
        continue;
      }

      console.error(
        `[manychat] ${tag.active ? "add" : "remove"} "${tag.name}" for ${contactId} failed (${response.status}): ${detail}`,
      );
      ok = false;
    } catch (error) {
      console.error(
        `[manychat] request failed for "${tag.name}" / ${contactId}`,
        error,
      );
      ok = false;
    }
  }

  return ok;
}
