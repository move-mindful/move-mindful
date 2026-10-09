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
}

const HOME: NavItem = { href: MEMBER_HOME, label: "Home", icon: House };
const SECTIONS: NavItem[] = [
  { href: "/classes", label: "Classes", icon: Clapperboard, nested: true },
  { href: "/live", label: "Live", icon: Radio, nested: true },
  { href: "/workouts", label: "Workouts", icon: Dumbbell, nested: true },
];

/**
 * Classes, Live and Workouts are on hold until the membership launches, so
 * members don't see them. Admins keep them to preview the sections — the pages
 * themselves enforce this via requireSectionUnlocked(). Drop the `admin` check
 * when releasing.
 */
export function navItems(admin: boolean): NavItem[] {
  return [HOME, ...(admin ? SECTIONS : [])];
}

export function isCurrent(item: Pick<NavItem, "href" | "nested">, pathname: string) {
  return pathname === item.href || (!!item.nested && pathname.startsWith(`${item.href}/`));
}
