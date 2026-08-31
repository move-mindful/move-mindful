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
 * The product shelf on /home, split into what the viewer has and what they
 * don't.
 *
 * A client component because the cards carry live prices: one offerings
 * round-trip here fills in every card, rather than each one fetching its own.
 * Everything else it renders is plain data passed down from the server, which
 * keeps the owned/not-owned decision where it belongs — on the server, in
 * `viewerCanAccess`.
 *
 * The buttons link to each product's page rather than starting checkout. The
 * sales page is what does the selling; a buy button here would skip the pitch.
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

  // productId (and package id) -> formatted price, for the cards that sell.
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
        // Cards just render without a price — the sales page still has one.
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
      <p className="mt-3 text-zinc-500">
        Your videos will appear here. Nothing to show just yet — check back
        soon.
      </p>
    );
  }

  return (
    <div className="mt-10 flex flex-col gap-12">
      {owned.length > 0 && (
        <Section title="Your Products">
          {owned.map(({ product }) => (
            <ProductCard key={product.slug} product={product} owned />
          ))}
        </Section>
      )}

      {available.length > 0 && (
        <Section title="Available for Purchase">
          {available.map(({ product }) => (
            <ProductCard
              key={product.slug}
              product={product}
              owned={false}
              price={
                product.revenueCatProductId
                  ? prices[product.revenueCatProductId]
                  : undefined
              }
              loadingPrice={loadingPrices}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const badgeCls =
  "absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm";

function ProductCard({
  product,
  owned,
  price,
  loadingPrice = false,
}: {
  product: Product;
  owned: boolean;
  price?: string;
  loadingPrice?: boolean;
}) {
  // `owned` doubles as "can watch": free products are owned by any signed-in
  // account, which is exactly who may see their thumbnail.
  const image = getProductCardImage(product, owned);
  const free = product.entitlement === null;
  const href = `/${product.slug}`;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:shadow-md">
      <Link href={href} className="relative block aspect-video bg-zinc-100">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            unoptimized={image.startsWith("http")}
            sizes="(min-width: 640px) 50vw, 100vw"
            className="object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <span className="absolute inset-0 bg-linear-to-br from-zinc-100 to-zinc-200" />
        )}
        {/* One badge, in this order: a free product is free whether or not
            the viewer has it, and only a paid one can have been bought. */}
        {free ? (
          <span className={`${badgeCls} bg-white/95 text-zinc-700`}>Free</span>
        ) : owned ? (
          <span className={`${badgeCls} bg-emerald-600 text-white`}>
            Purchased
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-semibold tracking-tight">
          <Link href={href} className="transition hover:text-zinc-600">
            {product.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {product.tagline}
        </p>

        {/* mt-auto so the buttons line up across cards whose taglines differ
            in length. */}
        <div className="mt-auto flex items-center justify-between gap-4 pt-6">
          <span className="text-sm text-zinc-500">
            {owned ? (
              product.videos.length > 0 ? (
                `${product.videos.length} ${product.videos.length === 1 ? "video" : "videos"}`
              ) : (
                "Coming soon"
              )
            ) : loadingPrice && !price ? (
              <span className="block h-5 w-16 animate-pulse rounded bg-zinc-100" />
            ) : (
              (price ?? "")
            )}
          </span>

          <Link
            href={href}
            className="inline-flex shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
          >
            {owned ? "Watch" : free ? "Get it free" : "Get it"}
          </Link>
        </div>
      </div>
    </div>
  );
}
