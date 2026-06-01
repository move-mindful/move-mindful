"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { configurePurchases, ENTITLEMENT_ID } from "@/lib/revenuecat";
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
      const purchases = configurePurchases(user!.id);
      const customerInfo = await purchases.getCustomerInfo();
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Plan</h2>

        {entitlement ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                Active
              </span>
              <span className="text-sm text-zinc-500">
                {formatProductName(entitlement.productIdentifier)}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500">Member since</dt>
                <dd className="mt-0.5 font-medium">
                  {entitlement.latestPurchaseDate.toLocaleDateString()}
                </dd>
              </div>

              {entitlement.expirationDate &&
                entitlement.expirationDate.getFullYear() < 2200 && (
                  <div>
                    <dt className="text-sm text-zinc-500">
                      {entitlement.willRenew ? "Renews on" : "Expires on"}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {entitlement.expirationDate.toLocaleDateString()}
                    </dd>
                  </div>
                )}

              {entitlement.unsubscribeDetectedAt && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-amber-600">
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
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                Manage Plan &rarr;
              </a>
            )}
          </div>
        ) : (
          <p className="mt-4 text-zinc-500">No active plan.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="mt-4 space-y-3">
          <div>
            <dt className="text-sm text-zinc-500">Email</dt>
            <dd className="mt-0.5 font-medium">
              {user?.primaryEmailAddress?.emailAddress}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-zinc-500">Name</dt>
            <dd className="mt-0.5 font-medium">{user?.fullName || "—"}</dd>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => openUserProfile()}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Edit Profile &rarr;
          </button>
          <button
            onClick={() =>
              openUserProfile({
                __experimental_startPath: "/security",
              })
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
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
