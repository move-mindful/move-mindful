"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, Clapperboard, Dumbbell, House, Radio, type LucideIcon } from "lucide-react";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * The phone navigation: a floating, frosted tab bar along the bottom, in the
 * style of iOS apps, on every page with the site header (the header's own
 * links take over from tablet width up). Signed-in only.
 *
 * Classes, Live and Workouts are admin-only until the membership launches —
 * the same rule as the header's links; drop the `admin` check with them when
 * releasing. Account is always there, so members have somewhere to go besides
 * Home.
 */

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Also current on pages under it (/classes/…). */
  nested?: boolean;
}

const HOME: Tab = { href: MEMBER_HOME, label: "Home", icon: House };
const SECTIONS: Tab[] = [
  { href: "/classes", label: "Classes", icon: Clapperboard, nested: true },
  { href: "/live", label: "Live", icon: Radio, nested: true },
  { href: "/workouts", label: "Workouts", icon: Dumbbell, nested: true },
];
const ACCOUNT: Tab = { href: "/account", label: "Account", icon: CircleUserRound };

export function TabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const tabs = [HOME, ...(admin ? SECTIONS : []), ACCOUNT];
  const current = (t: Tab) => pathname === t.href || (!!t.nested && pathname.startsWith(`${t.href}/`));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden">
      <nav
        aria-label="Main"
        className="pointer-events-auto flex max-w-full items-center rounded-full border border-black/[0.06] bg-white/75 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl backdrop-saturate-150"
      >
        {tabs.map((t) => {
          const on = current(t);
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
      </nav>
    </div>
  );
}

/** A tab's icon and label — lit when it's the current page, or the moment it's tapped. */
function TabFace({ tab, on }: { tab: Tab; on: boolean }) {
  // Inside the Link: true while its navigation is under way, so a tap shows at
  // once even when the page takes a moment (a slow connection, say).
  const { pending } = useLinkStatus();
  const lit = on || pending;
  const Icon = tab.icon;
  return (
    <span
      className={`flex w-full flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium transition-colors ${
        lit ? "bg-black/[0.07] text-zinc-900" : "text-zinc-500 active:bg-black/[0.04]"
      }`}
    >
      <Icon size={22} strokeWidth={lit ? 2.3 : 1.9} aria-hidden="true" />
      {tab.label}
    </span>
  );
}
