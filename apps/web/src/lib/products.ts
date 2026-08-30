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
   *
   * **null means free to anyone with an account.** No RevenueCat entitlement is
   * involved: a Clerk account is what puts someone in the system, and an
   * entitlement granted to every signup carries no information while adding a
   * grant call that can fail at the worst possible moment — right after someone
   * signed up for a freebie. Give a free product an entitlement only if it
   * shouldn't go to everyone.
   */
  entitlement: string | null;
  /**
   * RevenueCat *product* identifier (distinct from the entitlement above), used
   * to find this product's package across the configured offerings so the sales
   * page can show its real price and check out directly — rather than sending
   * people to /pricing, which lists everything in the current offering.
   *
   * If it matches no package, the buy button falls back to linking to /pricing,
   * so a wrong value degrades rather than breaks.
   */
  revenueCatProductId?: string;
  videos: ProductVideo[];
}

export const PRODUCTS: Product[] = [
  {
    slug: "posture",
    title: "Posture Reset",
    tagline: "Five short sessions to undo desk posture and move with ease.",
    entitlement: "posture",
    // Confirmed in the dashboard. Same string as the entitlement above, but a
    // distinct object — the product is what's sold, the entitlement is what it
    // unlocks. They needn't match for other products.
    revenueCatProductId: "posture",
    // Order here is the order they appear on the product page. Durations are
    // the real asset lengths from Mux, rounded to the nearest minute.
    // TODO: the titles below are placeholders — replace with the real session
    // names. They're visible to buyers on the product page and player.
    videos: [
      {
        slug: "session-1",
        title: "Session 1",
        playbackId: "1WVQFr011ztCuHxQ01clTR7vId2eGiTrfo3DI01I801wYxE",
        durationMinutes: 12,
      },
      {
        slug: "session-2",
        title: "Session 2",
        playbackId: "I01ddUdl1UA2q6LaUv2SclUzz01SAt01uiSsuODks00EIuI",
        durationMinutes: 12,
      },
      {
        slug: "session-3",
        title: "Session 3",
        playbackId: "W00fZc1Zqr02flodBXQeJ2ga3ZP1YErZxTJZOepht4iQU",
        durationMinutes: 11,
      },
      {
        slug: "session-4",
        title: "Session 4",
        playbackId: "BkKVVEA02c4tzQ6ZYYbHNdvTkeorz00B8FQcpKin7C2F8",
        durationMinutes: 11,
      },
      {
        slug: "session-5",
        title: "Session 5",
        playbackId: "1ABOOmlA02G02bRlGzloyDGAKYf3pLSgt022ca01iNtEgvY",
        durationMinutes: 11,
      },
    ],
  },

  {
    slug: "posture-routine",
    title: "12 Minute Posture Routine",
    tagline: "Stand taller. Move with ease. Feel good in your body.",
    // Free with any account — the top-of-funnel lead magnet.
    entitlement: null,
    videos: [
      {
        slug: "routine",
        title: "12 Minute Posture Routine",
        playbackId: "s8h8mNGwoi02019exYwLUdHjJo6j0113SdY4BrWXQAN84A",
        durationMinutes: 12,
      },
    ],
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
