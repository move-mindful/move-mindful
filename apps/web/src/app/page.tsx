import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MEMBER_HOME } from "@/lib/routes";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect(MEMBER_HOME);
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans">
      <main className="flex flex-col items-center gap-8 text-center px-8 py-32">
        <Image
          src="/logo.png"
          alt="Move Mindful"
          width={120}
          height={120}
          priority
        />
        <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          MoveMindful
        </h1>
        {/* No `dark:` variant here: globals.css pins --background to white with
            no prefers-color-scheme block, so the site has no dark theme. A
            dark: colour would fire on a viewer's OS setting alone and put light
            grey text on a white page. */}
        <p className="max-w-md text-lg leading-8 text-zinc-600">
          Helping people transform their posture, strength, mobility and
          balance
        </p>
        <div className="flex gap-4">
          {/* Points at the free class rather than a bare sign-up form: the
              label promises a class, and /class1 is where that promise is
              kept. It also earns the signup a `source:posture-routine` tag,
              which /sign-up on its own does not — see lib/audience-tags.ts. */}
          <Link
            href="/class1"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-zinc-700"
          >
            Try a Free Class
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-100"
          >
            Sign In
          </Link>
        </div>
        {/* No Pricing link yet: /pricing renders the whole current offering,
            which still includes the parked Challenge and Monthly packages.
            Restore this once that offering holds only what's actually on sale. */}
        <a
          href="mailto:contact@movemindful.com"
          className="text-sm text-zinc-500 hover:text-foreground"
        >
          Need help? contact@movemindful.com
        </a>
      </main>
    </div>
  );
}
