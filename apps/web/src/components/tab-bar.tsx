"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, type LucideIcon } from "lucide-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { NavDot, useChatDot } from "@/components/chat/chat-dot";
import { MoreMenu } from "@/components/more-menu";
import { isChatPage, isCurrent, navItems, type NavItem } from "@/components/nav-items";

/**
 * The phone navigation: a floating, frosted tab bar along the bottom, in the
 * style of iOS apps, on every signed-in page (the sidebar takes over from
 * tablet width up). Signed-in only.
 *
 * The sections, then ☰ More — the same menu as the sidebar's, as a sheet from
 * the bottom (MoreSheet, a BottomSheet). Account isn't a tab: it's the photo in the phone
 * header.
 */
export function TabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const chatDot = useChatDot();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  // The chat's back arrow is the way out of it, so it gets the whole screen.
  if (isChatPage(pathname)) return null;

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
                <TabFace tab={t} on={on} dot={t.href === "/chat" && chatDot} />
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

      {menuOpen && <MoreSheet admin={admin} onClose={close} />}
    </>
  );
}

/** The More menu on a phone, as a sheet from the bottom (swipe down to dismiss). */
function MoreSheet({ admin, onClose }: { admin: boolean; onClose: () => void }) {
  return (
    <BottomSheet onClose={onClose} label="Menu" className="md:hidden">
      <MoreMenu admin={admin} variant="sheet" onClose={onClose} />
    </BottomSheet>
  );
}

/** A section tab — lit when it's the current page, or the moment it's tapped. */
function TabFace({ tab, on, dot }: { tab: NavItem; on: boolean; dot: boolean }) {
  // Inside the Link: true while its navigation is under way, so a tap shows at
  // once even when the page takes a moment (a slow connection, say).
  const { pending } = useLinkStatus();
  return <TabLook icon={tab.icon} label={tab.label} lit={on || pending} dot={dot} />;
}

function TabLook({ icon: Icon, label, lit, dot = false }: { icon: LucideIcon; label: string; lit: boolean; dot?: boolean }) {
  return (
    <span
      className={`flex w-full flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium transition-colors ${
        lit
          ? "bg-black/[0.07] text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
          : "text-zinc-500 active:bg-black/[0.04] dark:text-zinc-400 dark:active:bg-white/[0.06]"
      }`}
    >
      <span className="relative flex">
        <Icon size={22} strokeWidth={lit ? 2.3 : 1.9} aria-hidden="true" />
        {/* Ringed in the bar's own colour, as on the Group Chat canvas. */}
        {dot && <NavDot ringClass="ring-white dark:ring-[#25292E]" />}
      </span>
      {label}
    </span>
  );
}
