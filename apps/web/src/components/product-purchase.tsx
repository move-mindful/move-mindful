"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { configurePurchases } from "@/lib/revenuecat";
import type { Package } from "@revenuecat/purchases-js";

const buttonCls =
  "mt-5 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Buy one specific product, from its own sales page.
 *
 * Finds this product's package across *all* configured offerings rather than
 * reading `offerings.current`, so the page checks out the thing it's actually
 * advertising. /pricing renders whatever the current offering holds, which is
 * the wrong destination for a single-product sales page — a buyer arriving from
 * /posture shouldn't land on a list including things that aren't for sale.
 *
 * Degrades rather than breaks: if no package matches (wrong id, offering not
 * configured yet, network failure), it falls back to linking to /pricing.
 */
export function ProductPurchase({
  userId,
  productSlug,
  revenueCatProductId,
}: {
  userId: string | null;
  productSlug: string;
  revenueCatProductId?: string;
}) {
  const router = useRouter();
  const [pkg, setPkg] = useState<Package | null>(null);
  // Derived, not set in the effect: with no product id there is nothing to look
  // up, so it starts settled and the fallback renders immediately.
  const [loading, setLoading] = useState(!!revenueCatProductId);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!revenueCatProductId) return;

    let cancelled = false;
    async function findPackage() {
      try {
        const purchases = await configurePurchases(userId);
        const offerings = await purchases.getOfferings();
        for (const offering of Object.values(offerings.all)) {
          const match = offering.availablePackages.find(
            (p) => p.webBillingProduct.identifier === revenueCatProductId,
          );
          if (match) {
            if (!cancelled) setPkg(match);
            break;
          }
        }
      } catch {
        // Leave pkg null — the /pricing fallback renders.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    findPackage();
    return () => {
      cancelled = true;
    };
  }, [userId, revenueCatProductId]);

  async function handleBuy() {
    if (!pkg) return;

    // A purchase needs a real RevenueCat App User ID, which is the Clerk id —
    // so signed-out shoppers create an account first and come straight back
    // here rather than to the global AFTER_SIGN_UP_URL (/pricing).
    if (!userId) {
      router.push(`/sign-up?redirect_url=${encodeURIComponent(`/${productSlug}`)}`);
      return;
    }

    setPurchasing(true);
    setError(null);
    try {
      const purchases = await configurePurchases(userId);
      await purchases.purchase({ rcPackage: pkg });
      // The server decides what's unlocked, so re-render rather than guessing
      // here: the page flips to the video list on its own.
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Purchase failed";
      if (!message.toLowerCase().includes("cancel")) setError(message);
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-5 h-6 w-32 animate-pulse rounded bg-zinc-100" />
    );
  }

  if (!pkg) {
    return (
      <Link href="/pricing" className={buttonCls}>
        {userId ? "Buy now" : "Get started"}
      </Link>
    );
  }

  return (
    <div>
      <p className="mt-4 text-3xl font-bold">
        {pkg.webBillingProduct.currentPrice.formattedPrice}
      </p>
      <button onClick={handleBuy} disabled={purchasing} className={buttonCls}>
        {purchasing ? "Processing…" : userId ? "Buy now" : "Get started"}
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
