"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo-mark";
import { MemberAvatar } from "@/components/member-avatar";
import { isChatPage, pageTitle } from "@/components/nav-items";
import { WeekStrip } from "@/components/workouts/week-strip";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * The phone's top bar: the logo (home), the name of the page you're on — Home,
 * Classes, Studio… — and the member's photo linking to Account. The tab bar's
 * last slot went to ☰ More, so this is where Account lives on a phone. Desktop
 * has the sidebar instead.
 *
 * No rule underneath: it's a frosted pane the page scrolls under. At the top
 * of a page there's only page behind it, so it reads as solid page colour; the
 * frost shows once content slides beneath.
 *
 * On /workouts the week strip rides in the pane too, so it stays put while
 * the cards scroll (the page shows its own copy from tablet width up).
 */
export function PhoneHeader() {
  const pathname = usePathname();

  // The chat draws its own, with a back arrow (components/chat/chat-headers.tsx).
  if (isChatPage(pathname)) return null;

  return (
    <header className="sticky top-0 z-30 bg-background/70 backdrop-blur-xl backdrop-saturate-150 md:hidden">
      <div className="flex h-16 items-center justify-between pr-2.5 pl-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={MEMBER_HOME} aria-label="MoveMindful home" className="shrink-0">
            <LogoMark size={40} />
          </Link>
          <span className="truncate text-[28px] leading-tight font-bold tracking-tight">
            {pageTitle(pathname) ?? "MoveMindful"}
          </span>
        </div>
        <Link
          href="/account"
          aria-label="Account"
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <MemberAvatar size={32} />
        </Link>
      </div>
      {pathname === "/workouts" && (
        <div className="px-6 pt-2 pb-3">
          <WeekStrip />
        </div>
      )}
    </header>
  );
}
