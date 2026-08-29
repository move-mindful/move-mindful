import Link from "next/link";
import { PRODUCTS } from "@/lib/products";
import { getViewerAccess, viewerCanAccess } from "@/lib/auth/viewer";

/**
 * The signed-in root — where every entry point lands (see MEMBER_HOME in
 * lib/routes.ts). Distinct from "/", which is the public marketing page.
 *
 * Lists what the viewer owns, and what they don't with a way in.
 */
export default async function HomePage() {
  const viewer = await getViewerAccess();

  const products = PRODUCTS.map((product) => ({
    product,
    owned: viewerCanAccess(viewer, product.entitlement),
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Home</h1>

      {products.length === 0 ? (
        <p className="mt-3 text-zinc-500">
          Your videos will appear here. Nothing to show just yet — check back soon.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(({ product, owned }) => (
            <Link
              key={product.slug}
              href={`/${product.slug}`}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{product.title}</h2>
                {owned ? (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    Yours
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                    Locked
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-500">{product.tagline}</p>
              <span className="mt-4 text-sm font-medium text-zinc-600">
                {owned
                  ? `Watch${product.videos.length ? ` · ${product.videos.length} videos` : ""} →`
                  : "Learn more →"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
