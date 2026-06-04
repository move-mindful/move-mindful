"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/classes", label: "Classes" },
  { href: "/live", label: "Live" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-4 text-sm">
      {links.map(({ href, label }) => {
        // Detail routes (e.g. /classes/[id]) keep their section highlighted.
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`border-b-2 pb-1 transition ${
              isActive
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
