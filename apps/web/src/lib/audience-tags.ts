/**
 * The Mailchimp tag vocabulary.
 *
 * Every tag written to the audience is built here, so the complete list of
 * things a member can be labelled with is readable in one file. Tags are the
 * only handle the marketing side has on who someone is — a typo'd or ad-hoc tag
 * doesn't error, it just quietly creates a second, near-identical segment that
 * nobody notices until a campaign goes to the wrong people.
 *
 * Slugs come from `lib/products.ts`, so a new product brings its own tags with
 * it rather than needing a string added here.
 */

/** Has an account. Written once, on `user.created`. */
export const SIGNUP_TAG = "signup";

/** Holds the recurring membership. */
export const MEMBER_TAG = "member";

/**
 * Which product's page they signed up from.
 *
 * Worth knowing that this is a stronger signal than it looks: the only thing
 * that sends a signed-out visitor to sign-up is a product page's buy button, so
 * `source:posture` means they clicked *buy*, not merely that they visited.
 */
export function sourceTag(productSlug: string): string {
  return `source:${productSlug}`;
}

/**
 * Owns the product.
 *
 * Reconciled against RevenueCat rather than written once at purchase — see the
 * RevenueCat webhook. It is removed again on a refund, so a segment built on it
 * can be trusted as "owns this right now", not "once paid for this".
 */
export function purchasedTag(productSlug: string): string {
  return `purchased:${productSlug}`;
}
