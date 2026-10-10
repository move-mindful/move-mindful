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

/**
 * The room's header, phones only: back and "Chat" (no profile photo, the
 * owner's call). Frosted and floating over the messages, which scroll under
 * it — except over the page's notices (chat isn't set up, couldn't connect),
 * where it just sits on top.
 */
export function RoomHeader({ floating = true }: { floating?: boolean }) {
  const router = useRouter();
  return (
    <PhoneBar
      title="Chat"
      floating={floating}
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
      <PhoneBar title="Thread" back={closeThread} backLabel="Back to the chat" floating className="md:hidden" />
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

/**
 * The phone header's look (components/phone-header.tsx), with the back arrow
 * in a round button where its logo goes, and no photo. `floating`: frosted,
 * over the top of the messages (chat-room.css gives the list room for it).
 */
function PhoneBar({
  title,
  back,
  backLabel,
  floating,
  className,
}: {
  title: ReactNode;
  back: () => void;
  backLabel: string;
  floating: boolean;
  className?: string;
}) {
  const place = floating
    ? "absolute inset-x-0 top-0 z-10 bg-background/70 backdrop-blur-xl backdrop-saturate-150"
    : "bg-background";
  return (
    <header className={`flex h-16 shrink-0 items-center gap-3 pr-3 pl-3 ${place} ${className ?? ""}`}>
      <button
        type="button"
        onClick={back}
        aria-label={backLabel}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] transition-colors active:bg-black/10 dark:bg-white/10 dark:active:bg-white/15"
      >
        <ChevronLeft size={24} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <span className="truncate text-[28px] leading-tight font-bold tracking-tight">{title}</span>
    </header>
  );
}
