import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/classes" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Image src="/logo.png" alt="Move Mindful" width={32} height={32} />
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
            <UserButton />
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
