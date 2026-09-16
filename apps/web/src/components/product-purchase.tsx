"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { configurePurchases } from "@/lib/revenuecat";
import { formatPrice } from "@/lib/price";
import type { Package } from "@revenuecat/purchases-js";

const defaultButtonCls =
  "mt-5 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50";

const defaultPriceCls = "mt-4 text-3xl font-bold";

/**
 * Marks a return from sign-up that should go straight to checkout.
 *
 * Written into the sign-up `redirect_url` on the way out and read back off the
 * URL on arrival, so someone who clicked buy before they had an account doesn't
 * have to click the same button again once they do.
 */
const CHECKOUT_PARAM = "checkout";

interface PurchaseState {
  pkg: Package | null;
  loading: boolean;
  purchasing: boolean;
  error: string | null;
  buy: () => void;
}

const PurchaseContext = createContext<PurchaseState | null>(null);

function usePurchase(): PurchaseState {
  const ctx = useContext(PurchaseContext);
  if (!ctx) {
    throw new Error("Purchase controls must be inside a <PurchaseProvider>");
  }
  return ctx;
}

/**
 * Holds the RevenueCat lookup and the checkout call for one product, so any
 * number of buttons on a page can share a single offerings round-trip.
 *
 * Finds this product's package across *all* configured offerings rather than
 * reading `offerings.current`, so the page checks out the thing it's actually
 * advertising. /pricing renders whatever the current offering holds, which is
 * the wrong destination for a single-product sales page — a buyer arriving from
 * /posture shouldn't land on a list including things that aren't for sale.
 *
 * Degrades rather than breaks: if no package matches (wrong id, offering not
 * configured yet, network failure), the controls fall back to /pricing.
 */
export function PurchaseProvider({
  userId,
  productSlug,
  revenueCatProductId,
  children,
}: {
  userId: string | null;
  productSlug: string;
  revenueCatProductId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // Clerk knows the address they just signed up with, so RevenueCat shouldn't
  // have to ask for it again. `isLoaded` matters to the resume path below.
  const { user, isLoaded: clerkLoaded } = useUser();
  const customerEmail = user?.primaryEmailAddress?.emailAddress;
  const [pkg, setPkg] = useState<Package | null>(null);
  // Derived, not set in the effect: with no product id there is nothing to look
  // up, so it starts settled and the fallback renders immediately.
  const [loading, setLoading] = useState(!!revenueCatProductId);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The in-flight lookup. A buyer who clicks before it settles — likely, since
  // the first call to action is above the fold — waits on this rather than
  // being handed a dead button.
  const lookup = useRef<Promise<Package | null> | null>(null);

  useEffect(() => {
    if (!revenueCatProductId) {
      lookup.current = Promise.resolve(null);
      return;
    }

    let cancelled = false;
    async function findPackage(): Promise<Package | null> {
      try {
        const purchases = await configurePurchases(userId);
        const offerings = await purchases.getOfferings();

        // Match the RevenueCat *product* identifier, falling back to the
        // *package* identifier. The dashboard shows products by display name,
        // so "Posture Reset" in the picker could be backed by an identifier of
        // posture, PostureReset or posture_reset — and the package sitting
        // around it has an identifier of its own. Accepting either means the
        // config value can be whichever one is to hand.
        let match: Package | undefined;
        for (const offering of Object.values(offerings.all)) {
          match =
            offering.availablePackages.find(
              (p) => p.webBillingProduct.identifier === revenueCatProductId,
            ) ??
            offering.availablePackages.find(
              (p) => p.identifier === revenueCatProductId,
            );
          if (match) break;
        }

        if (!match) {
          // The fallback is indistinguishable from working, so say what went
          // wrong and what *was* found. Usually the product exists in
          // RevenueCat but hasn't been added to a package in any offering —
          // creating a product doesn't put it in one.
          console.warn(
            `[product] No RevenueCat package found for product id "${revenueCatProductId}". ` +
              `Add it to a package in an offering. Currently available:`,
            Object.entries(offerings.all).map(([id, o]) => ({
              offering: id,
              packages: o.availablePackages.map((p) => ({
                packageId: p.identifier,
                productId: p.webBillingProduct.identifier,
              })),
            })),
          );
        }

        if (!cancelled) setPkg(match ?? null);
        return match ?? null;
      } catch (e) {
        // Leave pkg null — the /pricing fallback renders.
        console.warn("[product] RevenueCat offerings lookup failed", e);
        return null;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    lookup.current = findPackage();
    return () => {
      cancelled = true;
    };
  }, [userId, revenueCatProductId]);

  const buy = useCallback(async () => {
    // A purchase needs a real RevenueCat App User ID, which is the Clerk id —
    // so signed-out shoppers create an account first and come straight back
    // here rather than to the global AFTER_SIGN_UP_URL (/home). No need to wait
    // on the lookup: sign-up is the next step either way.
    //
    // The checkout flag rides along so the return lands in the payment form
    // they already asked for. Without it they arrive back on the sales page
    // having clicked "buy", done paperwork, and apparently achieved nothing —
    // which is a drop-off, not a step.
    if (!userId) {
      router.push(
        `/sign-up?redirect_url=${encodeURIComponent(
          `/${productSlug}?${CHECKOUT_PARAM}=1`,
        )}`,
      );
      return;
    }

    setPurchasing(true);
    setError(null);
    try {
      const target = pkg ?? (await lookup.current);
      if (!target) {
        router.push("/pricing");
        return;
      }

      const purchases = await configurePurchases(userId);
      await purchases.purchase({
        rcPackage: target,
        // Prefills the email field on RevenueCat's form. Left off entirely
        // rather than sent empty when Clerk hasn't answered — without it
        // RevenueCat asks the customer, which is the old behaviour and a fine
        // place to end up.
        ...(customerEmail ? { customerEmail } : {}),
      });
      // The server decides what's unlocked, so re-render rather than guessing
      // here: the page flips to the video list on its own.
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Purchase failed";
      if (!message.toLowerCase().includes("cancel")) setError(message);
    } finally {
      setPurchasing(false);
    }
  }, [userId, productSlug, pkg, router, customerEmail]);

  /**
   * Open checkout automatically for someone returning from sign-up.
   *
   * Reads `window.location.search` rather than `useSearchParams()`. The hook
   * subscribes to param changes and `replaceState` below syncs with the Next
   * router, so stripping the flag would re-render this provider and the whole
   * landing page under it — a full sales page re-render to clear a value that
   * nothing displays. It also keeps this component prerender-safe: on a
   * statically rendered route the hook client-renders everything up to the
   * nearest Suspense boundary, which here would be the entire page. This route
   * is dynamic today, but only because the page calls `auth()`, and that is not
   * a property this component should quietly depend on.
   *
   * Safe to fire without a click: `purchase()` mounts RevenueCat's form as an
   * in-page modal rather than opening a window, so there is no popup blocker
   * and no user-gesture requirement to satisfy.
   */
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !userId) return;
    // Wait for Clerk. This path runs a moment after a fresh sign-up, which is
    // exactly when `useUser()` is most likely still loading — and firing a tick
    // early would send no email in the one case where we are most certain of
    // it. Waiting costs nothing: the effect re-runs when Clerk answers, and if
    // it never does, the buy button still works.
    if (!clerkLoaded) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get(CHECKOUT_PARAM) !== "1") return;
    // Set before anything async is queued, so a re-render from the settling
    // lookup can't run this twice and stack two checkout modals.
    resumed.current = true;

    // Strip the flag so cancelling and reloading doesn't reopen checkout, and
    // so a copied URL is just the sales page. replaceState rather than
    // router.replace: a soft navigation here would re-render this provider and
    // throw away the offerings lookup that `buy()` is about to await.
    params.delete(CHECKOUT_PARAM);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );

    // Kicked out of the effect body rather than called inside it: `buy()` sets
    // its own loading state on entry, and doing that synchronously here would
    // cascade a second render straight off this one. A microtask runs right
    // after the commit, so nothing paints in between.
    //
    // Deliberately not a cancellable timer. This effect re-runs when `buy`
    // changes identity — which it does the moment the offerings lookup settles
    // — and a cleanup that cancelled the pending call would drop the purchase
    // on the floor, because the re-run finds `resumed` already set. The `buy`
    // captured here awaits `lookup.current` itself, so starting with a stale
    // `pkg` costs nothing.
    queueMicrotask(buy);
  }, [userId, clerkLoaded, buy]);

  return (
    <PurchaseContext.Provider value={{ pkg, loading, purchasing, error, buy }}>
      {children}
    </PurchaseContext.Provider>
  );
}

/**
 * A call to action that starts checkout.
 *
 * Always renders an enabled control, even while the offerings lookup is in
 * flight — a hero button that is disabled on arrival reads as broken, and
 * `buy()` waits on the lookup for us. The one exception is a settled lookup
 * that found nothing: then this is a plain link to /pricing, so the fallback
 * is a real navigation rather than a button that appears to do nothing.
 *
 * `showPrice` appends the real price to the label once RevenueCat answers
 * ("Get the Reset — $29.99"). The label has to read properly without it, since
 * it renders during the lookup and stays that way if the lookup finds nothing.
 */
export function BuyButton({
  className = defaultButtonCls,
  showPrice = false,
  children,
}: {
  className?: string;
  showPrice?: boolean;
  children?: React.ReactNode;
}) {
  const { pkg, loading, purchasing, buy } = usePurchase();

  const currentPrice = pkg?.webBillingProduct.currentPrice;
  const price = currentPrice && formatPrice(currentPrice);
  const label = (
    <>
      {children ?? "Buy now"}
      {showPrice && price && ` — ${price}`}
    </>
  );

  if (!loading && !pkg) {
    return (
      <Link href="/pricing" className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button onClick={buy} disabled={purchasing} className={className}>
      {purchasing ? "Processing…" : label}
    </button>
  );
}

/** The real price from RevenueCat. Never write one into page copy. */
export function PurchasePrice({
  className = defaultPriceCls,
  skeletonClassName = "mt-4 h-8 w-28 animate-pulse rounded bg-zinc-100",
}: {
  className?: string;
  skeletonClassName?: string;
}) {
  const { pkg, loading } = usePurchase();

  if (loading) return <div className={skeletonClassName} />;
  if (!pkg) return null;

  return (
    <p className={className}>{formatPrice(pkg.webBillingProduct.currentPrice)}</p>
  );
}

/** Whatever went wrong with the last checkout attempt. */
export function PurchaseError({
  className = "mt-3 text-sm text-red-600",
}: {
  className?: string;
}) {
  const { error } = usePurchase();
  return error ? <p className={className}>{error}</p> : null;
}

/**
 * Price + button in one, for the generic product page.
 *
 * The label follows sign-in state: a signed-out visitor is being sent to
 * sign-up first, so "Get started" is the honest word for what the click does.
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
  return (
    <PurchaseProvider
      userId={userId}
      productSlug={productSlug}
      revenueCatProductId={revenueCatProductId}
    >
      <PurchasePrice />
      <BuyButton>{userId ? "Buy now" : "Get started"}</BuyButton>
      <PurchaseError />
    </PurchaseProvider>
  );
}
