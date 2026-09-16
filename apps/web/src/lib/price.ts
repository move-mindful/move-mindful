/**
 * How a RevenueCat price is written on the site.
 *
 * RevenueCat's own `formattedPrice` is the starting point, never a string built
 * from the amount here: it already carries the currency symbol, its position,
 * and the locale's separators, and none of that is worth reimplementing.
 *
 * Kept SDK-free — it takes the two fields it needs structurally, so a `Price`
 * satisfies it without this module importing the SDK.
 */

/**
 * The price with a whole amount's empty decimals removed: "$27.00" reads "$27",
 * while "$29.99" is untouched.
 *
 * Whether to strip is decided from `amountMicros`, not by looking at the string.
 * A regex confident enough to spot ".00" is also confident enough to turn
 * "$29.99" into "$29" the day someone prices something at .99 — and the failure
 * is a page advertising a price nobody is charged.
 */
export function formatPrice(price: {
  amountMicros: number;
  formattedPrice: string;
}): string {
  // Micro-units: $9.99 is 9_990_000, so a whole amount divides exactly.
  if (price.amountMicros % 1_000_000 !== 0) return price.formattedPrice;

  // The decimal group is the last separator followed only by digits — the
  // lookahead is what keeps "$1,234.00" from losing its thousands separator
  // instead, and what leaves a currency with no minor unit ("¥2700") alone.
  return price.formattedPrice.replace(/[.,](\d+)(?=\D*$)/, "");
}
