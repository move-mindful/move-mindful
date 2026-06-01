import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Move Mindful
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/classes"
              className="text-sm font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
            >
              Classes
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
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
