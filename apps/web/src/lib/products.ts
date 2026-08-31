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
  /**
   * A short taster the sales page may play to anyone.
   *
   * Its own Mux asset, cut from the class with scripts/make-clip.mjs — never
   * the class's own `playbackId` with a stop time. Public policy means the id
   * *is* the video, so a page that ships the real id ships the whole class.
   *
   * Optional: without one, that routine simply shows no preview control.
   */
  previewPlaybackId?: string;
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
  /**
   * Artwork for the product's card on /home. Optional: without it the card
   * falls back to a thumbnail of the first video, so a new product looks
   * finished before anyone shoots anything for it.
   */
  cardImage?: string;
  videos: ProductVideo[];
}

/**
 * Card artwork for a product.
 *
 * Falls back to a thumbnail of the first video — but only for a viewer who can
 * already watch it. A Mux thumbnail URL carries the playback id, and these
 * assets use the public playback policy, so putting one in front of someone
 * who hasn't bought the product hands them the video itself. That's the same
 * reason the product page never sends playback ids to an unentitled browser.
 *
 * A paid product should therefore set `cardImage`. Without one, a non-owner's
 * card renders artwork-free rather than leaking.
 */
export function getProductCardImage(
  product: Product,
  viewerCanWatch: boolean,
): string | null {
  if (product.cardImage) return product.cardImage;
  if (!viewerCanWatch) return null;
  const first = product.videos[0];
  if (!first) return null;
  return `https://image.mux.com/${first.playbackId}/thumbnail.webp?width=800&height=450&fit_mode=smartcrop`;
}

export const PRODUCTS: Product[] = [
  {
    slug: "posture",
    title: "Posture & Mobility Reset",
    tagline:
      "Five follow-along routines to help you feel less stiff, stand taller, and move with more freedom.",
    entitlement: "posture",
    // Confirmed in the dashboard. Same string as the entitlement above, but a
    // distinct object — the product is what's sold, the entitlement is what it
    // unlocks. They needn't match for other products.
    revenueCatProductId: "posture",
    // The sales page's hero shot, rather than a frame of Day 1 — it reads as
    // the product, which a still from one routine doesn't.
    cardImage: "/posture/hero.jpg",
    // Order here is the order they appear on the product page. Durations are
    // the real asset lengths from Mux, rounded to the nearest minute.
    //
    // Titles and descriptions are the approved sales copy — the sales page
    // (components/products/posture-landing.tsx) renders this same list, so the
    // lineup a buyer reads before purchase and the one they get after are the
    // same data. Edit here, not there.
    videos: [
      {
        slug: "day-1",
        title: "Day 1: Posture Foundations",
        description:
          "Gentle hip and neck movements to release tension and improve mobility, then we'll work to activate and strengthen the muscles along the back of the body that support a more upright, balanced posture.",
        playbackId: "1WVQFr011ztCuHxQ01clTR7vId2eGiTrfo3DI01I801wYxE",
        previewPlaybackId: "RNYJunFdYCjH014h2X01DGOsvdmweTb9T8r02K9JcZpGxQ",
        durationMinutes: 12,
      },
      {
        slug: "day-2",
        title: "Day 2: Core & Hip Support",
        description:
          "Create space through the hips while strengthening the core and improving control around the pelvis, building a more stable foundation for better posture.",
        playbackId: "I01ddUdl1UA2q6LaUv2SclUzz01SAt01uiSsuODks00EIuI",
        previewPlaybackId: "2j01701jZGo00CNBAhOsOSwxZWFAkPRg901AIRVBx2PmxAM",
        durationMinutes: 12,
      },
      {
        slug: "day-3",
        title: "Day 3: Reversing Rounded Shoulders",
        description:
          "Open the chest and improve shoulder mobility with targeted movements that help counteract slouching and make a more upright posture feel natural.",
        playbackId: "W00fZc1Zqr02flodBXQeJ2ga3ZP1YErZxTJZOepht4iQU",
        previewPlaybackId: "K02kChW6MQxG9lvb5ElUQIpGh02ABoIqRrv8cq8JKx02Zk",
        durationMinutes: 11,
      },
      {
        slug: "day-4",
        title: "Day 4: Move Your Spine in all Directions",
        description:
          "Move your spine through flexion, extension, side bending, and rotation to improve mobility, ease stiffness, and help your entire back feel less restricted.",
        playbackId: "BkKVVEA02c4tzQ6ZYYbHNdvTkeorz00B8FQcpKin7C2F8",
        previewPlaybackId: "mzgeye32BXKA4mpCevye6c8MveG7qaSeAKGvawB5U00E",
        durationMinutes: 11,
      },
      {
        slug: "day-5",
        title: "Day 5: Full Body Freedom",
        description:
          "Bring everything together with dynamic movements that mobilize the shoulders, move the spine, open the hips, and help your entire body move with greater freedom and ease.",
        playbackId: "1ABOOmlA02G02bRlGzloyDGAKYf3pLSgt022ca01iNtEgvY",
        previewPlaybackId: "zurqWIoGhWlo8qbiLOSLU6IARGhdnj7OTAAWFtkDJEE",
        durationMinutes: 11,
      },
    ],
  },

  {
    slug: "posture-routine",
    title: "12 Minute Posture and Mobility Routine",
    tagline: "Stand taller. Move with ease. Feel good in your body.",
    // Free with any account — the top-of-funnel lead magnet.
    entitlement: null,
    // A frame from the routine itself (3:18), so the card shows the class
    // rather than whatever happens to be at the very start.
    cardImage: "/posture-routine/card.jpg",
    videos: [
      {
        slug: "routine",
        title: "12 Minute Posture and Mobility Routine",
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
