import Image from "next/image";
import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@clerk/nextjs/server";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * Shell for every signed-in page.
 *
 * Requires an account (enforced in proxy.ts) but *no* entitlement, so it fits
 * everyone who signs up: free-tier signups from the top of the funnel, one-time
 * product buyers, and members alike. That's why /home, /account and /help live
 * here — a buyer who doesn't hold the membership entitlement still needs to
 * reach their own account page.
 *
 * Entitlement gating is layered on by nested layouts — see (member)/layout.tsx.
 *
 * It also renders for signed-out visitors on the one public route inside the
 * group: a product's sales page, which has to load for someone who has never
 * signed in. Hence the signed-out branches below.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();
  const signedIn = !!userId;
  const admin = sessionClaims?.metadata?.role === "admin";

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href={signedIn ? MEMBER_HOME : "/"}
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <Image src="/logo.png" alt="MoveMindful" width={32} height={32} />
              MoveMindful
            </Link>
            {/* Signed-out visitors are here for a sales page and have nowhere
                to navigate to — /home needs an account. */}
            {signedIn && (
              <div className="flex items-center gap-4 text-sm text-zinc-600">
                <Link
                  href={MEMBER_HOME}
                  className="transition hover:text-zinc-900"
                >
                  Home
                </Link>
                {/* Classes and Live are on hold until the membership launches,
                    so members don't see them. Admins keep the links to preview
                    the sections — the pages themselves enforce this via
                    requireSectionUnlocked(). Drop the `admin &&` when
                    releasing. */}
                {admin && (
                  <>
                    <Link
                      href="/classes"
                      className="transition hover:text-zinc-900"
                    >
                      Classes
                    </Link>
                    <Link
                      href="/live"
                      className="transition hover:text-zinc-900"
                    >
                      Live
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
          {signedIn ? (
            <UserMenu isAdmin={admin} />
          ) : (
            <Link
              href="/sign-in"
              className="text-sm text-zinc-600 transition hover:text-zinc-900"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>
      {/* flex column so a nested layout's full-height states (e.g. the
          entitlement gate's spinner) can stretch to fill the viewport. */}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
