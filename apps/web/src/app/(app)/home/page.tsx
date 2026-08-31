import { auth } from "@clerk/nextjs/server";
import { Outfit } from "next/font/google";
import { PRODUCTS } from "@/lib/products";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";
import { HomeProducts } from "@/components/home-products";

/**
 * The signed-in root — where every entry point lands (see MEMBER_HOME in
 * lib/routes.ts). Distinct from "/", which is the public marketing page.
 *
 * The viewer's library is the page; anything they don't own follows it as a
 * promo band. The owned/not-owned split is decided here, server-side; the
 * component below only renders it (and fills in live prices).
 */

/**
 * The landing pages' typeface, for the promo band only — that band is an ad for
 * a sales page, so it speaks in that page's voice while the library above it
 * stays in the app's own type.
 *
 * Scoped through a CSS variable on the wrapper rather than swapped in globally,
 * the same way posture-landing.tsx scopes it. Only the two weights the band
 * actually uses, so we ship no more of the face than that.
 */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-outfit",
});

export default async function HomePage() {
  const [viewer, { userId }] = await Promise.all([getViewerAccess(), auth()]);

  const items = PRODUCTS.map((product) => ({
    product,
    owned: viewerCanAccess(viewer, product.entitlement),
  }));

  return (
    <div
      className={`${outfit.variable} mx-auto max-w-6xl px-6 py-12 sm:px-8`}
    >
      {/* No page heading: the section heading below carries it, and "Home"
          above it was a label for a page with one thing on it. */}
      <HomeProducts items={items} userId={userId} />
    </div>
  );
}
