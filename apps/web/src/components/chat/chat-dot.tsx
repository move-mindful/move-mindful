"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getChatDot } from "@/app/actions/chat";
import { isChatPage } from "@/components/nav-items";

/**
 * Whether the Chat tab (and the sidebar's Chat icon) shows its violet dot:
 * a trainer has posted since the member last had the chat open
 * (lib/chat/dot-server.ts). Asked after each page change and when the tab
 * comes back into view, so it never holds up a page; off on the chat itself.
 * Only for people who can open the chat (admins, for now).
 */
const ChatDot = createContext(false);

export function ChatDotProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [dot, setDot] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Opening the chat sees what's there, so the dot goes at once rather than
  // when the next answer comes back.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (isChatPage(pathname)) setDot(false);
  }

  useEffect(() => {
    if (!enabled || isChatPage(pathname)) return;
    let live = true;
    const ask = () => {
      getChatDot()
        .then((d) => live && setDot(d))
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") ask();
    };
    ask();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, pathname]);

  return <ChatDot value={enabled && !isChatPage(pathname) && dot}>{children}</ChatDot>;
}

export function useChatDot(): boolean {
  return use(ChatDot);
}

/**
 * The dot itself, at the icon's top-right corner: 8px of violet-500 with a
 * thin ring of whatever it sits on (`ringClass`) to set it off the icon's
 * outline. The icon's wrapper must be `relative`.
 */
export function NavDot({ ringClass }: { ringClass: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={`absolute top-0 -right-0.5 size-2 rounded-full bg-violet-500 ring-[1.5px] ${ringClass}`}
      />
      <span className="sr-only">, new post from a trainer</span>
    </>
  );
}
