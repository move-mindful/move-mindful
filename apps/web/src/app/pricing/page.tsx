import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import Link from "next/link";
import { PricingClient } from "@/components/pricing-client";

export default async function PricingPage() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col flex-1 items-center px-8 py-16 text-center">
      <Image src="/logo.png" alt="MoveMindful" width={64} height={64} />
      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
        Choose Your Plan
      </h1>
      <p className="mt-4 max-w-md text-lg text-zinc-500">
        Start your journey with a 30-day challenge or go all-in with a monthly
        membership.
      </p>

      {userId ? (
        <PricingClient userId={userId} />
      ) : (
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-full bg-foreground px-8 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
          >
            Sign Up to Get Started
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-zinc-500 hover:text-foreground"
          >
            Already have an account? Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
