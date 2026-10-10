import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChatDotProvider } from "@/components/chat/chat-dot";
import { PhoneHeader } from "@/components/phone-header";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";

/**
 * Shell for every signed-in page.
 *
 * Requires an account (enforced in proxy.ts) but *no* entitlement, so it fits
 * everyone who signs up: free-tier signups from the top of the funnel, one-time
 * product buyers, and members alike. That's why /home, /account and /help live
 * here — a buyer who doesn't hold the membership entitlement still needs to
 * reach their own account page.
 *
 * Entitlement gating is layered on by nested layouts — see (member)/layout.tsx.
 *
 * Navigation is Instagram-style: a sidebar down the left on desktop; on a phone
 * a frosted header (logo, and the member's photo for Account) and the tab bar.
 * Both end in ☰ More, which holds Settings, Switch appearance, Help, Admin and
 * Sign out. `data-app-shell` is what scopes dark mode to these pages — see
 * globals.css.
 *
 * It also renders for signed-out visitors on the one public route inside the
 * group: a product's sales page, which has to load for someone who has never
 * signed in. They have nowhere to navigate to — /home needs an account — so
 * they get a plain bar with the logo and Sign in, and no dark mode.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, sessionClaims } = await auth();
  const admin = sessionClaims?.metadata?.role === "admin";

  if (!userId) {
    return (
      <div className="flex flex-col flex-1">
        <header className="border-b border-zinc-200">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Image src="/logo-mark.png" alt="MoveMindful" width={32} height={32} />
              MoveMindful
            </Link>
            <Link href="/sign-in" className="text-sm text-zinc-600 transition hover:text-zinc-900">
              Sign in
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    );
  }

  return (
    // Room on the left for the sidebar's narrow column (it widens over the
    // page, not into it). data-no-page-scrollbar: the page scrolls without
    // showing a scroll bar, like the player (globals.css).
    <div data-app-shell data-no-page-scrollbar className="flex flex-1 flex-col md:pl-[72px]">
      {/* The Chat tab's dot when a trainer has posted — admins only while chat is. */}
      <ChatDotProvider enabled={admin}>
        <Sidebar admin={admin} />
        <PhoneHeader />
        {/* flex column so a nested layout's full-height states (e.g. the
            entitlement gate's spinner) can stretch to fill the viewport. On
            phones, room at the bottom so the tab bar never covers the end of a
            page. */}
        <main className="flex flex-1 flex-col pb-24 md:pb-0">{children}</main>
        <TabBar admin={admin} />
      </ChatDotProvider>
    </div>
  );
}
