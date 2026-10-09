"use client";

import { useUser } from "@clerk/nextjs";
import { planTitle } from "@/components/nav-items";

/**
 * /workouts' heading, "Max's plan" — from the member's Clerk account, so it's
 * read in the browser like their photo (MemberAvatar). Blank until the account
 * loads, rather than switching from "Your plan" as it arrives. On a phone the
 * header shows it instead, so here it's for screen readers only.
 */
export function PlanTitle() {
  const { user, isLoaded } = useUser();
  return (
    <h1 className="text-2xl font-bold tracking-tight max-md:sr-only">
      {isLoaded ? planTitle(user?.firstName ?? null) : " "}
    </h1>
  );
}
