/**
 * Carrying a ManyChat contact id from a DM link through to a Clerk user.
 *
 * ManyChat identifies people by contact id; the site identifies them by Clerk
 * user. Nothing joins the two unless we deliberately carry an identifier
 * across, so a ManyChat button URL appends `?mc={{contact_id}}` and the chain
 * from there is: query param -> cookie -> Clerk `unsafeMetadata` at sign-up ->
 * `privateMetadata` on the `user.created` webhook. After that every tag we push
 * reads the id off the Clerk user.
 *
 * Kept free of SDK imports so the proxy (edge runtime), the sign-up page and
 * the webhooks can all share one definition.
 */

/** Query parameter on a ManyChat link: `/posture?mc={{contact_id}}`. */
export const MC_QUERY_PARAM = "mc";

/** First-party cookie the proxy stashes it in. */
export const MC_COOKIE = "mc_contact";

/**
 * Thirty days. Long enough to cover the gap between clicking a DM link and
 * getting round to signing up, which is routinely days rather than minutes.
 */
export const MC_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * ManyChat contact ids are numeric strings.
 *
 * Validated everywhere it is read, because this value arrives in a query string
 * and therefore belongs to whoever typed the URL. It ends up in a Clerk
 * metadata field and in the body of a ManyChat API call, so an unchecked value
 * is untrusted input reaching two other systems. Anything that isn't a plain
 * run of digits is discarded rather than sanitised — there is no legitimate
 * contact id it would reject.
 */
export function isValidContactId(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[0-9]{1,32}$/.test(value);
}

/** The contact id on a request's query string, if it carries a usable one. */
export function readContactId(params: URLSearchParams): string | null {
  const value = params.get(MC_QUERY_PARAM);
  return isValidContactId(value) ? value : null;
}
