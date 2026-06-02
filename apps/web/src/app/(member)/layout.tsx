import Image from "next/image";
import Link from "next/link";
import { EntitlementGate } from "@/components/entitlement-gate";
import { UserMenu } from "@/components/user-menu";
import { isAdmin } from "@/lib/auth/admin";

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
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link
              href="/classes"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <Image src="/logo.png" alt="MoveMindful" width={32} height={32} />
              MoveMindful
            </Link>
            <UserMenu isAdmin={admin} />
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </EntitlementGate>
  );
}
