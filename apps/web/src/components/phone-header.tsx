import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { MemberAvatar } from "@/components/member-avatar";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * The phone's top bar: the logo (home) and the member's photo linking to
 * Account. The tab bar's last slot went to ☰ More, so this is where Account
 * lives on a phone. Desktop has the sidebar instead.
 *
 * No rule underneath: it's a frosted pane the page scrolls under. At the top
 * of a page there's only page behind it, so it reads as solid page colour; the
 * frost shows once content slides beneath.
 */
export function PhoneHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background/70 pr-2.5 pl-4 backdrop-blur-xl backdrop-saturate-150 md:hidden">
      <Link href={MEMBER_HOME} aria-label="MoveMindful home" className="shrink-0">
        <LogoMark size={40} />
      </Link>
      <Link
        href="/account"
        aria-label="Account"
        className="flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <MemberAvatar size={32} />
      </Link>
    </header>
  );
}
