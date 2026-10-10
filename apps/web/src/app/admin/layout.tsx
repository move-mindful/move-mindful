import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { MEMBER_HOME } from "@/lib/routes";
import { UserMenu } from "@/components/user-menu";

const navItems = [
  { href: "/admin/workouts", label: "Workouts" },
  { href: "/admin/exercises", label: "Exercises" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/instructors", label: "Instructors" },
  { href: "/admin/collections", label: "Collections" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative gate: 404 for non-admins (the proxy redirect is only optimistic).
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/admin/workouts"
              className="flex items-center gap-2 text-lg font-bold tracking-tight"
            >
              <Image src="/logo-mark.png" alt="MoveMindful" width={32} height={32} />
              Admin
            </Link>
            <div className="hidden items-center gap-4 text-sm text-zinc-600 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={MEMBER_HOME}
              className="text-sm text-zinc-500 transition hover:text-zinc-800"
            >
              &larr; Member site
            </Link>
            <UserMenu />
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
