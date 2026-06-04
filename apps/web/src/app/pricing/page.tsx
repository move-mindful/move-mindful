import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { PricingClient } from "@/components/pricing-client";

export default async function PricingPage() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col flex-1">
      {userId && (
        <header className="border-b border-zinc-200">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Image src="/logo.png" alt="MoveMindful" width={32} height={32} />
              MoveMindful
            </div>
            <UserButton />
          </nav>
        </header>
      )}
      <div className="flex flex-col flex-1 items-center px-8 py-16 text-center">
        {!userId && <Image src="/logo.png" alt="MoveMindful" width={64} height={64} />}
      <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
        Choose Your Plan
      </h1>
      <p className="mt-4 max-w-md text-lg text-zinc-500">
        Start your journey with a 30-day challenge or go all-in with a monthly
        membership.
      </p>

      <PricingClient userId={userId} />

      {!userId && (
        <Link
          href="/sign-in"
          className="mt-8 text-sm text-zinc-500 hover:text-foreground"
        >
          Already have an account? Sign in
        </Link>
      )}
      </div>
    </div>
  );
}
