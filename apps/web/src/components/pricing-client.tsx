"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configurePurchases, ENTITLEMENT_ID } from "@/lib/revenuecat";
import type { Package } from "@revenuecat/purchases-js";

export function PricingClient({ userId }: { userId: string | null }) {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const purchases = await configurePurchases(userId);

      // Only signed-in users can have an entitlement; an anonymous shopper
      // never does, so skip the check (and avoid creating a throwaway customer).
      if (userId) {
        const customerInfo = await purchases.getCustomerInfo();
        if (ENTITLEMENT_ID in customerInfo.entitlements.active) {
          router.replace("/classes");
          return;
        }
      }

      const offerings = await purchases.getOfferings();
      if (offerings.current) {
        setPackages(offerings.current.availablePackages);
      }
      setLoading(false);
    }

    init();
  }, [userId, router]);

  async function handlePurchase(pkg: Package) {
    // Logged-out shoppers must create an account before purchasing. Clerk's
    // AFTER_SIGN_UP_URL returns them here, signed in, to complete checkout.
    if (!userId) {
      router.push("/sign-up");
      return;
    }
    setPurchasing(pkg.identifier);
    setError(null);
    try {
      const purchases = await configurePurchases(userId);
      const { customerInfo } = await purchases.purchase({
        rcPackage: pkg,
      });
      if (ENTITLEMENT_ID in customerInfo.entitlements.active) {
        router.push("/classes");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Purchase failed";
      if (!message.includes("cancelled")) {
        setError(message);
      }
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <p className="text-center text-zinc-500 py-16">
        No plans available at the moment. Please check back soon.
      </p>
    );
  }

  return (
    <div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 max-w-2xl mx-auto">
        {packages.map((pkg) => {
          const product = pkg.rcBillingProduct;
          const price = product.currentPrice;
          const isMonthly = product.normalPeriodDuration !== undefined;

          return (
            <div
              key={pkg.identifier}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6"
            >
              <h3 className="text-lg font-semibold">{product.title}</h3>
              {product.description && (
                <p className="mt-2 text-sm text-zinc-500">
                  {product.description}
                </p>
              )}
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  {price.formattedPrice}
                </span>
                {isMonthly && (
                  <span className="text-sm text-zinc-500">/month</span>
                )}
              </div>
              <button
                onClick={() => handlePurchase(pkg)}
                disabled={purchasing !== null}
                className="mt-6 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purchasing === pkg.identifier
                  ? "Processing..."
                  : isMonthly
                    ? "Subscribe"
                    : "Buy Now"}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-6 text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
