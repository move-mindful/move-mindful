import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { EntitlementGate } from "@/components/entitlement-gate";

function CreditCardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
      <path d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" />
    </svg>
  );
}

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EntitlementGate>
      <div className="flex flex-col flex-1">
        <header className="border-b border-zinc-200">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/classes" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Image src="/logo.png" alt="MoveMindful" width={32} height={32} />
              MoveMindful
            </Link>
            <div className="flex items-center gap-6">
              <Link
                href="/classes"
                className="text-sm font-medium text-zinc-600 hover:text-foreground"
              >
                Classes
              </Link>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-zinc-600 hover:text-foreground"
              >
                Dashboard
              </Link>
              <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  label="Manage Subscription"
                  labelIcon={<CreditCardIcon />}
                  href="/dashboard"
                />
                <UserButton.Action label="manageAccount" />
                <UserButton.Action label="signOut" />
              </UserButton.MenuItems>
            </UserButton>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </EntitlementGate>
  );
}
