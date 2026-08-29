import Image from "next/image";
import Link from "next/link";
import { EntitlementGate } from "@/components/entitlement-gate";
import { UserMenu } from "@/components/user-menu";
import { isAdmin } from "@/lib/auth/admin";
import { MEMBER_HOME } from "@/lib/routes";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();

  return (
    <EntitlementGate>
      <div className="flex flex-col flex-1">
        <header className="border-b border-zinc-200">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3 sm:gap-6">
              <Link
                href={admin ? "/classes" : MEMBER_HOME}
                className="flex items-center gap-2 text-lg font-bold tracking-tight"
              >
                <Image src="/logo.png" alt="MoveMindful" width={32} height={32} />
                MoveMindful
              </Link>
              {/* Classes and Live are on hold until the membership launches, so
                  members don't see them. Admins keep the links to preview the
                  sections — the pages themselves enforce this via
                  requireSectionUnlocked(). Drop the `admin &&` when releasing. */}
              {admin && (
                <div className="flex items-center gap-4 text-sm text-zinc-600">
                  <Link href="/classes" className="transition hover:text-zinc-900">
                    Classes
                  </Link>
                  <Link href="/live" className="transition hover:text-zinc-900">
                    Live
                  </Link>
                </div>
              )}
            </div>
            <UserMenu isAdmin={admin} />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </EntitlementGate>
  );
}
