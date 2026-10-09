"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { configurePurchases, MEMBERSHIP_ENTITLEMENT } from "@/lib/revenuecat";
import type { EntitlementInfo } from "@revenuecat/purchases-js";

export function AccountClient() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const [entitlement, setEntitlement] = useState<EntitlementInfo | null>(null);
  const [managementURL, setManagementURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const purchases = await configurePurchases(user!.id);
      const customerInfo = await purchases.getCustomerInfo();
      const active = customerInfo.entitlements.active[MEMBERSHIP_ENTITLEMENT];
      if (active) {
        setEntitlement(active);
      }
      setManagementURL(customerInfo.managementURL);
      setLoading(false);
    }

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 dark:border-white/10 border-t-zinc-800 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold">Plan</h2>

        {entitlement ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                Active
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatProductName(entitlement.productIdentifier)}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Member since</dt>
                <dd className="mt-0.5 font-medium">
                  {entitlement.latestPurchaseDate.toLocaleDateString()}
                </dd>
              </div>

              {entitlement.expirationDate &&
                entitlement.expirationDate.getFullYear() < 2200 && (
                  <div>
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">
                      {entitlement.willRenew ? "Renews on" : "Expires on"}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {entitlement.expirationDate.toLocaleDateString()}
                    </dd>
                  </div>
                )}

              {entitlement.unsubscribeDetectedAt && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Cancellation pending — you&apos;ll keep access until your
                    current period ends.
                  </p>
                </div>
              )}
            </dl>

            {managementURL && (
              <a
                href={managementURL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              >
                Manage Plan &rarr;
              </a>
            )}
          </div>
        ) : (
          <p className="mt-4 text-zinc-500 dark:text-zinc-400">No active plan.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="mt-0.5 font-medium">
              {user?.primaryEmailAddress?.emailAddress}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500 dark:text-zinc-400">Name</dt>
            <dd className="mt-0.5 font-medium">{user?.fullName || "—"}</dd>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => openUserProfile()}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            Edit Profile &rarr;
          </button>
          <button
            onClick={() =>
              openUserProfile({
                __experimental_startPath: "/security",
              })
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            Change Password &rarr;
          </button>
        </div>
      </section>
    </div>
  );
}

function formatProductName(productId: string): string {
  if (productId.includes("monthly") || productId.includes("Monthly"))
    return "Monthly Membership";
  if (productId.includes("challenge") || productId.includes("Challenge"))
    return "30-Day Challenge";
  if (productId.includes("promo")) return "Promotional Access";
  return productId;
}
