"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, type LucideIcon } from "lucide-react";
import { MoreMenu } from "@/components/more-menu";
import { isCurrent, navItems, type NavItem } from "@/components/nav-items";

/**
 * The phone navigation: a floating, frosted tab bar along the bottom, in the
 * style of iOS apps, on every signed-in page (the sidebar takes over from
 * tablet width up). Signed-in only.
 *
 * The sections, then ☰ More — the same menu as the sidebar's, as a sheet from
 * the bottom. Account isn't a tab: it's the photo in the phone header.
 */
export function TabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden">
        <nav
          aria-label="Main"
          className="pointer-events-auto flex max-w-full items-center rounded-full border border-black/[0.06] bg-white/75 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08] dark:bg-[#25292E]/75 dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        >
          {navItems(admin).map((t) => {
            const on = isCurrent(t, pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className="flex w-[72px] min-w-0 shrink"
              >
                <TabFace tab={t} on={on} />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            className="flex w-[72px] min-w-0 shrink"
          >
            <TabLook icon={Menu} label="More" lit={menuOpen} />
          </button>
        </nav>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 animate-[sheet-up_0.25s_ease-out] rounded-t-[20px] bg-white px-2 pt-2 pb-[max(32px,env(safe-area-inset-bottom))] dark:bg-[#25292E]">
            <span
              aria-hidden="true"
              className="mx-auto mb-2 block h-[5px] w-9 rounded-full bg-zinc-300 dark:bg-white/20"
            />
            <MoreMenu admin={admin} variant="sheet" onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}

/** A section tab — lit when it's the current page, or the moment it's tapped. */
function TabFace({ tab, on }: { tab: NavItem; on: boolean }) {
  // Inside the Link: true while its navigation is under way, so a tap shows at
  // once even when the page takes a moment (a slow connection, say).
  const { pending } = useLinkStatus();
  return <TabLook icon={tab.icon} label={tab.label} lit={on || pending} />;
}

function TabLook({ icon: Icon, label, lit }: { icon: LucideIcon; label: string; lit: boolean }) {
  return (
    <span
      className={`flex w-full flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium transition-colors ${
        lit
          ? "bg-black/[0.07] text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
          : "text-zinc-500 active:bg-black/[0.04] dark:text-zinc-400 dark:active:bg-white/[0.06]"
      }`}
    >
      <Icon size={22} strokeWidth={lit ? 2.3 : 1.9} aria-hidden="true" />
      {label}
    </span>
  );
}
