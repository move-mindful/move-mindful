"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { configurePurchases, syncUserAttributes, ENTITLEMENT_ID } from "@/lib/revenuecat";

export function EntitlementGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "granted" | "denied">(
    "loading",
  );

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function checkEntitlement() {
      const purchases = await configurePurchases(user!.id);
      syncUserAttributes(purchases, user!);
      const customerInfo = await purchases.getCustomerInfo();
      if (ENTITLEMENT_ID in customerInfo.entitlements.active) {
        setStatus("granted");
      } else {
        setStatus("denied");
        router.replace("/pricing");
      }
    }

    checkEntitlement();
  }, [isLoaded, user, router]);

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  if (status === "denied") {
    return null;
  }

  return <>{children}</>;
}
