"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { configurePurchases } from "@/lib/revenuecat";
import { getProductCardImage, type Product } from "@/lib/products";

export interface HomeProduct {
  product: Product;
  owned: boolean;
}

/**
 * Everything below the header on /home: the viewer's library, then a promo band
 * for each product they don't own.
 *
 * The two are told apart by register rather than by a pair of matching section
 * headings — white cards under "Your library", a dark band for anything still
 * being sold. So the page needs no "Available for Purchase" label, and a viewer
 * who owns everything simply gets their library with nothing appended.
 *
 * A client component because the bands carry live prices: one offerings
 * round-trip here fills in every band, rather than each one fetching its own.
 * Everything else it renders is plain data passed down from the server, which
 * keeps the owned/not-owned decision where it belongs — on the server, in
 * `viewerCanAccess`.
 *
 * The buttons link to each product's page rather than starting checkout. The
 * sales page is what does the selling; a buy button here would skip the pitch.
 *
 * Note that admins hold every entitlement (see `viewerCanAccess`), so no band
 * ever renders for one — testing that half of this page needs a non-admin
 * account.
 */
export function HomeProducts({
  items,
  userId,
}: {
  items: HomeProduct[];
  userId: string | null;
}) {
  const owned = items.filter((i) => i.owned);
  const available = items.filter((i) => !i.owned);

  // productId (and package id) -> formatted price, for the bands that sell.
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loadingPrices, setLoadingPrices] = useState(available.length > 0);

  useEffect(() => {
    if (available.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const purchases = await configurePurchases(userId);
        const offerings = await purchases.getOfferings();

        // Key by both identifiers for the same reason the sales page matches on
        // either: a product's RevenueCat id and the id of the package wrapping
        // it need not agree, and products.ts may carry whichever was to hand.
        const found: Record<string, string> = {};
        for (const offering of Object.values(offerings.all)) {
          for (const pkg of offering.availablePackages) {
            const price = pkg.webBillingProduct.currentPrice.formattedPrice;
            found[pkg.webBillingProduct.identifier] = price;
            found[pkg.identifier] = price;
          }
        }
        if (!cancelled) setPrices(found);
      } catch (e) {
        // Bands just render without a price — the sales page still has one.
        console.warn("[home] RevenueCat offerings lookup failed", e);
      } finally {
        if (!cancelled) setLoadingPrices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `available.length` rather than the array: a new identity every render
    // would re-run this on every keystroke elsewhere on the page.
  }, [userId, available.length]);

  if (items.length === 0) {
    return (
      <p className="text-zinc-500">
        Your videos will appear here. Nothing to show just yet — check back
        soon.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-14">
      {owned.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              Your library
            </h2>
            <span className="text-sm text-zinc-400">
              {owned.length} {owned.length === 1 ? "class" : "classes"}
            </span>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map(({ product }) => (
              <LibraryCard key={product.slug} product={product} />
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <div className="flex flex-col gap-6">
          {available.map(({ product }) => (
            <PromoBand
              key={product.slug}
              product={product}
              price={
                product.revenueCatProductId
                  ? prices[product.revenueCatProductId]
                  : undefined
              }
              loadingPrice={loadingPrices}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** "5 videos · 57 min", degrading as the data thins out. */
function libraryMeta(product: Product): string {
  const count = product.videos.length;
  if (count === 0) return "Coming soon";

  const videos = `${count} ${count === 1 ? "video" : "videos"}`;
  const minutes = product.videos.reduce(
    (total, video) => total + (video.durationMinutes ?? 0),
    0,
  );
  return minutes > 0 ? `${videos} · ${minutes} min` : videos;
}

/**
 * A product the viewer owns.
 *
 * No "Purchased" badge: it sits under a heading that already says so. Nor a
 * "Free" one — what a viewer paid is their business, not a label on their own
 * shelf.
 */
function LibraryCard({ product }: { product: Product }) {
  const href = `/${product.slug}`;
  // Owned, so the thumbnail fallback is safe here: the viewer may already
  // watch the video whose playback id it carries.
  const image = getProductCardImage(product, true);

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-md">
      <Link href={href} className="relative block aspect-video bg-zinc-100">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            unoptimized={image.startsWith("http")}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 bg-linear-to-br from-zinc-100 to-zinc-200" />
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold tracking-tight">
          <Link href={href} className="transition hover:text-zinc-600">
            {product.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 text-pretty">
          {product.tagline}
        </p>

        {/* mt-auto so the buttons line up across cards whose taglines differ
            in length. */}
        <div className="mt-auto flex items-center justify-between gap-4 pt-4">
          <span className="text-sm text-zinc-500">{libraryMeta(product)}</span>
          <Link
            href={href}
            className="inline-flex shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
          >
            Watch
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * A product the viewer doesn't own — an ad, and dressed as one.
 *
 * The dark ground is the whole point: it reads as a different kind of thing to
 * the white library cards above without needing a heading to say so.
 */
function PromoBand({
  product,
  price,
  loadingPrice = false,
}: {
  product: Product;
  price?: string;
  loadingPrice?: boolean;
}) {
  const href = `/${product.slug}`;
  // `false` because the viewer cannot watch this yet, and the fallback it
  // suppresses is a Mux thumbnail — a public-policy playback id, which is the
  // video. A paid product without `cardImage` renders artwork-free instead.
  const image = getProductCardImage(product, false);

  return (
    <section className="grid overflow-hidden rounded-[20px] bg-[#14142B] sm:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4 p-8 sm:order-1 sm:p-10 lg:px-11">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-[#A896F5] uppercase">
          Go further
        </span>
        <h2 className="font-[family-name:var(--font-outfit)] text-2xl leading-[1.15] font-semibold tracking-[-0.028em] text-white text-pretty sm:text-[28px]">
          {product.title}
        </h2>
        <p className="max-w-[34em] text-[15.5px] leading-relaxed text-[#B4AECE] text-pretty">
          {product.tagline}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={href}
            className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#7A5FEA] to-[#4CC7E0] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90"
          >
            {product.ctaLabel ?? "Get it"}
          </Link>
          {loadingPrice && !price ? (
            <span className="block h-6 w-20 animate-pulse rounded bg-white/10" />
          ) : price ? (
            <span className="text-xl font-semibold tracking-[-0.02em] text-white">
              {price}
            </span>
          ) : null}
          <span className="text-[13px] text-[#8B84AA]">One-time payment</span>
        </div>
      </div>

      {/* Image above the copy on a phone, beside it from `sm` up. The scrim
          runs from the band's own colour into transparency, so it always fades
          on whichever edge meets the copy. */}
      <div className="relative order-first aspect-video bg-[#23213F] sm:order-2 sm:aspect-auto sm:min-h-[240px]">
        {image && (
          <Image
            src={image}
            alt=""
            fill
            unoptimized={image.startsWith("http")}
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 300px, 100vw"
            className="object-cover"
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-[#14142B] via-[#14142B]/10 to-transparent sm:bg-linear-to-r"
        />
      </div>
    </section>
  );
}
