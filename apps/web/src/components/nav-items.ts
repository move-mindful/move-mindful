import { Dumbbell, House, MessageCircle, Radio, type LucideIcon } from "lucide-react";
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
// Classes ({ href: "/classes", label: "Classes", icon: Clapperboard, nested: true })
// is put away for now, admins included — see hideSection() in lib/auth/locked-sections.ts.
const SECTIONS: NavItem[] = [
  { href: "/workouts", label: "Workout", icon: Dumbbell, nested: true, title: "Your plan" },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  // Called Studio in the navigation; the page itself stays at /live.
  { href: "/live", label: "Studio", icon: Radio, nested: true },
];

/**
 * Workouts, Chat and Studio are on hold until the membership launches, so
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

/**
 * The chat, which on a phone takes the whole screen with its own header and
 * back arrow — the site's phone header and tab bar step aside there.
 */
export function isChatPage(pathname: string) {
  return pathname === "/chat" || pathname.startsWith("/chat/");
}

export function isCurrent(item: { href: string; nested?: boolean }, pathname: string) {
  return pathname === item.href || (!!item.nested && pathname.startsWith(`${item.href}/`));
}
