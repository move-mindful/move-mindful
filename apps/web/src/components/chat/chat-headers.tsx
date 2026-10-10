"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import type { ThreadHeaderProps } from "stream-chat-react";
import { MEMBER_HOME } from "@/lib/routes";

/**
 * The chat's own phone headers. On /chat the site's header and tab bar step
 * aside (PhoneHeader, TabBar) and the chat draws these instead, with a back
 * arrow where the logo goes: from a thread back to the room, from the room
 * back to wherever the member came from. A thread opens inside the page
 * (Stream swaps the room for it on a phone), so only the chat knows which
 * one is showing. Desktop keeps the sidebar and needs no header in the room.
 */

/** The room's header, phones only: back and "Chat" (no profile photo, the owner's call). */
export function RoomHeader() {
  const router = useRouter();
  return (
    <PhoneBar
      title="Chat"
      back={() => {
        // Opened straight from a link, there's nowhere to go back to: Home.
        if (window.history.length > 1) router.back();
        else router.push(MEMBER_HOME);
      }}
      backLabel="Back"
      className="md:hidden"
    />
  );
}

/**
 * A thread's header, in place of Stream's. On a phone, the same bar as the
 * room's, its back arrow closing the thread; on desktop, where the thread is
 * a panel beside the room, a slim title bar with a close button.
 */
export function ThreadHeader({ closeThread }: ThreadHeaderProps) {
  return (
    <>
      <PhoneBar title="Thread" back={closeThread} backLabel="Back to the chat" className="md:hidden" />
      <div className="hidden h-14 shrink-0 items-center justify-between border-b border-zinc-200 pr-2 pl-4 md:flex dark:border-white/10">
        <span className="text-lg font-bold tracking-tight">Thread</span>
        <button
          type="button"
          onClick={closeThread}
          aria-label="Close thread"
          className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

/** The phone header's look (components/phone-header.tsx), with a back arrow where its logo goes and no photo. */
function PhoneBar({
  title,
  back,
  backLabel,
  className,
}: {
  title: ReactNode;
  back: () => void;
  backLabel: string;
  className?: string;
}) {
  return (
    <header className={`flex h-16 shrink-0 items-center gap-0.5 bg-background pr-2.5 pl-1.5 ${className ?? ""}`}>
      <button type="button" onClick={back} aria-label={backLabel} className="flex size-11 shrink-0 items-center justify-center">
        <ChevronLeft size={28} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <span className="truncate text-[28px] leading-tight font-bold tracking-tight">{title}</span>
    </header>
  );
}
