import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getProduct } from "@/lib/products";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";
import { FreeClassLanding } from "@/components/products/free-class-landing";

/**
 * /class1 — the advertised URL for the free 12-minute routine.
 *
 * A **marketing URL only**. The product itself stays at /<slug> with everything
 * that hangs off that slug untouched: the player routes, the /home card, the
 * proxy's derived public-route list, and the `source:<slug>` Mailchimp tag that
 * is already collecting signup attribution. A URL you put in an ad and a slug
 * the code keys off change for different reasons, and pinning them together
 * would mean a rename breaks links and splits the tag stream.
 *
 * So this route is deliberately thin: it renders the sales page, and sends
 * anyone who already has an account to the class itself. There is no purchase
 * to make — the product's entitlement is null, so a Clerk account is the whole
 * gate, and someone signed in already owns it.
 */

/** The product this page sells. Not derived from the URL — see above. */
const PRODUCT_SLUG = "posture-routine";

export const metadata: Metadata = {
  title: "Free 12 Minute Posture and Mobility Routine — MoveMindful",
  description:
    "A daily routine designed to help you feel less stiff and more open throughout your entire body. Free with a MoveMindful account.",
};

export default async function FreeClassPage() {
  const product = getProduct(PRODUCT_SLUG);
  // Only reachable if someone renames or removes the product without updating
  // this page. 404 rather than rendering a page that sells nothing.
  if (!product) notFound();

  const viewer = await getViewerAccess();

  // Already has it — the pitch is pointless, so hand them the class. Free
  // products are owned by any signed-in account, so this is really "signed in".
  if (viewerCanAccess(viewer, product.entitlement)) {
    redirect(`/${product.slug}`);
  }

  return <FreeClassLanding product={product} signedIn={viewer.signedIn} />;
}
