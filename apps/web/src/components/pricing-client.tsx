"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { configurePurchases, MEMBERSHIP_ENTITLEMENT } from "@/lib/revenuecat";
import { MEMBER_HOME } from "@/lib/routes";
import { ProductType, type Package } from "@revenuecat/purchases-js";

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
        if (MEMBERSHIP_ENTITLEMENT in customerInfo.entitlements.active) {
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
    // Logged-out shoppers must create an account before purchasing, then come
    // straight back here to complete checkout.
    if (!userId) {
      // Carry the return path explicitly rather than leaning on the global
      // AFTER_SIGN_UP_URL, which now points at /home — the right landing for
      // someone signing up from the homepage with nothing to buy, and the wrong
      // one for a shopper mid-checkout.
      router.push("/sign-up?redirect_url=%2Fpricing");
      return;
    }
    setPurchasing(pkg.identifier);
    setError(null);
    try {
      const purchases = await configurePurchases(userId);
      const { customerInfo } = await purchases.purchase({
        rcPackage: pkg,
      });
      // Route on *any* completed purchase, not just the membership. This page
      // renders whatever the current offering holds, which now includes
      // one-time products — and checking only for the membership entitlement
      // left a Posture Reset buyer sitting on the pricing page, payment taken,
      // with no acknowledgement that anything had happened.
      //
      // /home is right for both: it lists everything the viewer owns, and it
      // needs no entitlement to reach.
      router.push(
        MEMBERSHIP_ENTITLEMENT in customerInfo.entitlements.active
          ? "/classes"
          : MEMBER_HOME,
      );
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
          const product = pkg.webBillingProduct;
          const price = product.currentPrice;
          // Ask what the product *is*, rather than inferring from the period.
          // `normalPeriodDuration` is `null` for non-subscriptions, and the
          // obvious `!== undefined` test passes for null — which billed every
          // one-time product on this page as "$29.99 /month · Subscribe".
          const isSubscription = product.productType === ProductType.Subscription;

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
                {isSubscription && (
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
                  : isSubscription
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
