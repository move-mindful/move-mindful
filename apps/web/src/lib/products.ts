/**
 * One-off products — the video series sold as individual lifetime purchases.
 *
 * Deliberately hardcoded rather than run through the class-library CMS. These
 * are small, fixed sets of videos that won't be re-tagged, re-ordered or
 * curated, so tags, collections and per-class access rules would be overhead
 * with no payoff. Adding a product means adding an entry here — the page,
 * routing and access check all read from this list.
 *
 * Kept SDK-free so client and server can both import it.
 *
 * To add a product:
 *   1. Create the entitlement and the product in RevenueCat.
 *   2. Add an entry below, with `entitlement` matching the RevenueCat
 *      entitlement identifier exactly.
 *   3. Paste each video's Mux playback id.
 * No other code changes — /<slug> starts working, /home lists it, and the
 * proxy treats it as a public sales page automatically.
 */

export interface ProductVideo {
  /** URL segment: /<product>/<slug> */
  slug: string;
  title: string;
  description?: string;
  /** Mux playback id. Public policy, so the id alone streams the video. */
  playbackId: string;
  durationMinutes?: number;
}

export interface Product {
  /** URL segment: /<slug> */
  slug: string;
  title: string;
  /** One line under the title on the product page and the /home card. */
  tagline: string;
  /**
   * RevenueCat entitlement that unlocks it — must match the dashboard exactly.
   * Whether the membership also grants this is decided in RevenueCat (attach
   * the membership product to this entitlement), never here.
   */
  entitlement: string;
  videos: ProductVideo[];
}

export const PRODUCTS: Product[] = [
  {
    slug: "posture",
    title: "Posture",
    tagline: "Five short sessions to undo desk posture and move with ease.",
    // TODO: confirm against the RevenueCat dashboard once the entitlement exists.
    entitlement: "posture",
    // TODO: paste the Mux playback ids once the videos are uploaded. Until then
    // the product page shows its locked/sales state and lists nothing.
    videos: [],
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductVideo(
  product: Product,
  videoSlug: string,
): ProductVideo | undefined {
  return product.videos.find((v) => v.slug === videoSlug);
}
