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
  /**
   * What the page itself is called, when that isn't its tab's label — or how
   * to make it from the member's first name (null when they have none).
   */
  title?: string | ((firstName: string | null) => string);
}

/** /workouts' name: the member's plan, by first name ("Max's plan") when their account has one. */
export function planTitle(firstName: string | null) {
  const name = firstName?.trim();
  return name ? `${name}’s plan` : "Your plan";
}

const HOME: NavItem = { href: MEMBER_HOME, label: "Home", icon: House };
const SECTIONS: NavItem[] = [
  { href: "/classes", label: "Classes", icon: Clapperboard, nested: true },
  // Called Studio in the navigation; the page itself stays at /live.
  { href: "/live", label: "Studio", icon: Radio, nested: true },
  { href: "/workouts", label: "Workout", icon: Dumbbell, nested: true, title: planTitle },
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
 * for a page outside them (a product's videos, say). `firstName` is undefined
 * while the member's account is still loading; a name made from it is blank
 * till then, rather than switching from "Your plan" as it arrives.
 */
export function pageTitle(pathname: string, firstName?: string | null): string | null {
  const page: Pick<NavItem, "label" | "title"> | undefined = [HOME, ...SECTIONS, ...OTHER_PAGES].find((p) =>
    isCurrent(p, pathname),
  );
  if (!page) return null;
  if (typeof page.title === "function") return firstName === undefined ? "" : page.title(firstName);
  return page.title ?? page.label;
}

export function isCurrent(item: { href: string; nested?: boolean }, pathname: string) {
  return pathname === item.href || (!!item.nested && pathname.startsWith(`${item.href}/`));
}
