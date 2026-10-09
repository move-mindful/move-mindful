"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { MemberAvatar } from "@/components/member-avatar";
import { MoreMenu, useAppearance } from "@/components/more-menu";
import { isCurrent, navItems } from "@/components/nav-items";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * The desktop navigation, in the style of Instagram's: a column down the left
 * edge, icons only until the pointer is over it, when it widens over the page
 * to show the labels. ☰ More sits at the foot, where the old header's menu
 * button went. Tablet width up; phones get the tab bar and header instead.
 *
 * It widens *over* the page rather than pushing it, so the page never reflows
 * as the pointer passes — the page leaves room for the 72px column only. It also
 * stays wide while the More menu is open, and while a keyboard user is tabbing
 * through it.
 */
export function Sidebar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Keeps the page's light/dark in step with the device (Automatic) and with
  // other tabs. Here because the sidebar is on every signed-in page — hidden,
  // but still mounted, on phones.
  useAppearance();

  // Close on a click anywhere else, or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <aside
      ref={ref}
      data-open={menuOpen || undefined}
      className={`group/side fixed inset-y-0 left-0 z-40 hidden w-[72px] bg-background transition-[width,box-shadow] duration-200 ease-out md:block ${WIDE}`}
    >
      <nav aria-label="Main" className="flex h-full flex-col overflow-hidden px-3 pt-2 pb-5">
        <Link
          href={MEMBER_HOME}
          aria-label="MoveMindful home"
          className="flex h-[84px] shrink-0 items-center px-2.5"
        >
          <LogoMark size={28} />
        </Link>

        <div className="my-auto flex flex-col gap-2">
          {navItems(admin).map((item) => {
            const on = isCurrent(item, pathname);
            const Icon = item.icon;
            return (
              <SideLink key={item.href} href={item.href} label={item.label} on={on}>
                {on && item.href === MEMBER_HOME ? (
                  <HouseFilled />
                ) : (
                  <Icon size={24} strokeWidth={on ? 2.5 : 2} className="shrink-0" aria-hidden="true" />
                )}
              </SideLink>
            );
          })}
          <SideLink href="/account" label="Account" on={pathname === "/account"}>
            <MemberAvatar size={24} />
          </SideLink>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          className={`${ROW} shrink-0 ${menuOpen ? "font-bold" : ""}`}
        >
          <Menu size={24} strokeWidth={menuOpen ? 2.5 : 2} className="shrink-0" aria-hidden="true" />
          <Label>More</Label>
        </button>
      </nav>

      {menuOpen && (
        <div className="absolute bottom-[76px] left-3 w-[266px] rounded-2xl bg-white p-2 shadow-[0_4px_24px_rgba(0,0,0,0.16)] dark:bg-[#25292E] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          <MoreMenu admin={admin} variant="popover" onClose={() => setMenuOpen(false)} />
        </div>
      )}
    </aside>
  );
}

/** The widened state: hovered, More open, or keyboard focus inside. */
const WIDE = [
  "hover:w-[244px] data-open:w-[244px] has-[:focus-visible]:w-[244px]",
  "hover:shadow-[8px_0_24px_rgba(0,0,0,0.08)] data-open:shadow-[8px_0_24px_rgba(0,0,0,0.08)] has-[:focus-visible]:shadow-[8px_0_24px_rgba(0,0,0,0.08)]",
  "dark:hover:shadow-[1px_0_0_rgba(255,255,255,0.08),8px_0_24px_rgba(0,0,0,0.5)] dark:data-open:shadow-[1px_0_0_rgba(255,255,255,0.08),8px_0_24px_rgba(0,0,0,0.5)] dark:has-[:focus-visible]:shadow-[1px_0_0_rgba(255,255,255,0.08),8px_0_24px_rgba(0,0,0,0.5)]",
].join(" ");

const ROW =
  "flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10";

function SideLink({
  href,
  label,
  on,
  children,
}: {
  href: string;
  label: string;
  on: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`${ROW} ${on ? "font-bold" : ""}`}
    >
      {children}
      <Label>{label}</Label>
    </Link>
  );
}

/** Hidden while the column is narrow; fades in as it widens. */
function Label({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-base opacity-0 transition-opacity duration-200 group-hover/side:opacity-100 group-has-[:focus-visible]/side:opacity-100 group-data-open/side:opacity-100">
      {children}
    </span>
  );
}

/**
 * Lucide's House, filled with the door cut out — Home when it's the current
 * page, as Instagram marks it. The door takes the page colour, so it reads as
 * a cut-out in light and dark alike.
 */
function HouseFilled() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="currentColor"
        stroke="currentColor"
      />
      <path
        d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
        className="fill-background stroke-background"
      />
    </svg>
  );
}
