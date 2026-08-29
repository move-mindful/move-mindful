/**
 * The RevenueCat entitlement catalog.
 *
 * Entitlement *identifiers* (the keys in `customerInfo.entitlements.active`),
 * not display names. Kept framework- and SDK-free so both client and server code
 * can import this.
 *
 * One entitlement per sellable thing. That's what lets the same video series be
 * sold on its own, bundled, comped from the dashboard, or thrown in with the
 * membership — all without a deploy.
 */

/** The recurring membership: the on-demand class library and live classes. */
export const MEMBERSHIP_ENTITLEMENT = "Move Mindful Pro";

export interface EntitlementOption {
  /** Must match the RevenueCat dashboard identifier exactly. */
  id: string;
  /** Label shown in the admin CMS picker. */
  label: string;
}

/**
 * Everything a class can require, in the order the admin picker shows them.
 *
 * **This list is the only code change needed to launch a new product.** Create
 * the entitlement and product in RevenueCat, add a row here, and it becomes
 * selectable on every class. The picker reads this list rather than accepting
 * free text on purpose: a typo'd identifier would silently make content either
 * unreachable or free, and neither failure is visible from the admin UI.
 */
export const ENTITLEMENT_OPTIONS: EntitlementOption[] = [
  { id: MEMBERSHIP_ENTITLEMENT, label: "Membership — class library + live" },
  // One-time purchases go here, one row per product. For example:
  // { id: "series_foundations", label: "Foundations Series — one-time" },
];

/** How "no entitlement required" reads in the admin picker. */
export const FREE_ACCESS_LABEL = "Free — any signed-in account";

/**
 * Can someone holding `held` watch a class requiring `required`?
 *
 * `required` of null means free, so any signed-in account passes. Everything
 * else is a straight membership test — including the membership itself, which
 * is just another entitlement here. If the membership should include a product,
 * attach the membership product to that product's entitlement in RevenueCat;
 * don't special-case it in code.
 */
export function canAccess(
  required: string | null | undefined,
  held: ReadonlySet<string>,
): boolean {
  if (!required) return true;
  return held.has(required);
}
