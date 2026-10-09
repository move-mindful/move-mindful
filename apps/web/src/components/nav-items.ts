import { Clapperboard, Dumbbell, House, Radio, type LucideIcon } from "lucide-react";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * The signed-in site's main sections — shared by the desktop sidebar and the
 * phone tab bar, so the two can't drift apart.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Also current on pages under it (/classes/…). */
  nested?: boolean;
  /** What the page itself is called, when that isn't its tab's label. */
  title?: string;
}

const HOME: NavItem = { href: MEMBER_HOME, label: "Home", icon: House };
const SECTIONS: NavItem[] = [
  { href: "/classes", label: "Classes", icon: Clapperboard, nested: true },
  // Called Studio in the navigation; the page itself stays at /live.
  { href: "/live", label: "Studio", icon: Radio, nested: true },
  { href: "/workouts", label: "Workout", icon: Dumbbell, nested: true, title: "Your plan" },
];

/**
 * Classes, Studio and Workouts are on hold until the membership launches, so
 * members don't see them. Admins keep them to preview the sections — the pages
 * themselves enforce this via requireSectionUnlocked(). Drop the `admin` check
 * when releasing.
 */
export function navItems(admin: boolean): NavItem[] {
  return [HOME, ...(admin ? SECTIONS : [])];
}

/** Pages with no tab of their own that the phone header still names. */
const OTHER_PAGES = [
  { href: "/account", label: "Account" },
  { href: "/help", label: "Help" },
];

/**
 * What the phone header calls the current page: its section's name, or null
 * for a page outside them (a product's videos, say).
 */
export function pageTitle(pathname: string): string | null {
  const page: { label: string; title?: string } | undefined = [HOME, ...SECTIONS, ...OTHER_PAGES].find((p) =>
    isCurrent(p, pathname),
  );
  return page ? (page.title ?? page.label) : null;
}

export function isCurrent(item: { href: string; nested?: boolean }, pathname: string) {
  return pathname === item.href || (!!item.nested && pathname.startsWith(`${item.href}/`));
}
