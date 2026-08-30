import { auth } from "@clerk/nextjs/server";
import { PRODUCTS } from "@/lib/products";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";
import { HomeProducts } from "@/components/home-products";

/**
 * The signed-in root — where every entry point lands (see MEMBER_HOME in
 * lib/routes.ts). Distinct from "/", which is the public marketing page.
 *
 * Lists what the viewer owns, and what they don't with a way in. The
 * owned/not-owned split is decided here, server-side; the grid below only
 * renders it (and fills in live prices).
 */
export default async function HomePage() {
  const [viewer, { userId }] = await Promise.all([getViewerAccess(), auth()]);

  const items = PRODUCTS.map((product) => ({
    product,
    owned: viewerCanAccess(viewer, product.entitlement),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Home</h1>
      <HomeProducts items={items} userId={userId} />
    </div>
  );
}
