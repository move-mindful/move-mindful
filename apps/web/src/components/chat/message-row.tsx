"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { ChevronRight, SmilePlus } from "lucide-react";
import {
  Attachment,
  Avatar,
  MessageActions,
  MessageText,
  isDateSeparatorMessage,
  isMessageDeleted,
  messageHasAttachments,
  useMessageContext,
} from "stream-chat-react";
import { MessageSheet } from "@/components/chat/message-sheet";
import { REACTION_LIST } from "@/components/chat/reactions";

/**
 * One message, Ladder-style (plan.md → Group Chat; the Group Chat canvas):
 * a flat, left-aligned row — avatar, bold name, muted time, then the text —
 * for everyone, the viewer included. Built from Stream's own pieces (the text
 * with its @mentions and links, attachments, the message menu) inside our
 * layout, in place of Stream's chat bubbles.
 *
 * Trainers — Stream's admin role, which only our server can give (see
 * joinCommunityChat) — get a Trainer badge, and the words of their posts sit
 * in a violet-to-orchid gradient box; their photos and videos don't.
 *
 * A run of messages from one person shows the avatar and name once, as Slack
 * does. The message's options (react, reply in a thread, copy, edit, delete,
 * report): on a phone, hold the message down for a sheet, as in Ladder
 * (MessageSheet); on desktop, Stream's menu on hover.
 */
export function MessageRow() {
  const { message, firstOfGroup, groupedByUser, threadList, handleOpenThread, handleAction, handleRetry, renderText } =
    useMessageContext("MessageRow");

  const deleted = isMessageDeleted(message);
  const trainer = message.user?.role === "admin";
  const continued = groupedByUser && !firstOfGroup;
  const replies = !threadList && !deleted ? (message.reply_count ?? 0) : 0;
  const name = message.user?.name || "Member";
  // "8:02 AM" in the viewer's own clock; the day separators give the day.
  const sent = message.created_at ? new Date(message.created_at) : null;
  const [sheet, setSheet] = useState(false);
  const press = useLongPress(() => setSheet(true));

  if (isDateSeparatorMessage(message)) return null;

  return (
    <div {...press} className={`mm-row relative flex gap-3 px-4 ${continued ? "pt-0.5 pb-1" : "pt-3 pb-1"}`}>
      {continued ? (
        <span aria-hidden="true" className="w-9 shrink-0" />
      ) : (
        <Avatar
          imageUrl={message.user?.image as string | undefined}
          userName={name}
          size="md"
          className="mm-row__avatar shrink-0"
        />
      )}
      {replies > 0 && !continued && (
        // The line from the avatar down into "N replies".
        <span
          aria-hidden="true"
          className="absolute top-[56px] bottom-[14px] left-[33px] w-[22px] rounded-bl-xl border-b-2 border-l-2 border-zinc-200 dark:border-white/15"
        />
      )}

      <div className="min-w-0 flex-1">
        {!continued && (
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold">{name}</span>
            {trainer && (
              <span className="shrink-0 rounded-md bg-violet-500/15 px-[7px] py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                Trainer
              </span>
            )}
            {sent && (
              <time dateTime={sent.toISOString()} className="shrink-0 text-[13px] text-zinc-500 dark:text-zinc-400">
                {sent.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </time>
            )}
          </div>
        )}

        {deleted ? (
          <p className="mt-0.5 text-[15px] text-zinc-500 italic dark:text-zinc-400">This message was deleted.</p>
        ) : (
          <>
            {message.text && (
              <div className={trainer ? "mm-row__trainer-text mt-2 mb-1 w-fit max-w-full" : "mm-row__text mt-0.5"}>
                <MessageText message={message} renderText={renderText} />
              </div>
            )}
            {messageHasAttachments(message) && (
              <div className="mm-row__attachments mt-1.5 max-w-[280px]">
                <Attachment attachments={message.attachments ?? []} actionHandler={handleAction} />
              </div>
            )}
            <Reactions />
            {message.status === "failed" && (
              <button
                type="button"
                onClick={() => handleRetry(message)}
                className="mt-1 text-[13px] font-semibold text-red-600 dark:text-red-400"
              >
                Not sent · Try again
              </button>
            )}
            {replies > 0 && (
              <button
                type="button"
                onClick={handleOpenThread}
                className="mt-3 flex h-5 items-center gap-1.5 text-[14px] font-semibold text-violet-700 dark:text-violet-400"
              >
                {replies === 1 ? "1 reply" : `${replies} replies`}
                <span className="flex items-center gap-0.5 font-medium text-zinc-500 dark:text-zinc-400">
                  · View thread
                  <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {!deleted && (
        <div className="mm-row__menu absolute top-1 right-3">
          <MessageActions />
        </div>
      )}
      {sheet && <MessageSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

/** How long a finger has to stay down for the message's sheet, in ms. */
const HOLD_MS = 450;

/**
 * Press and hold, for touch screens: fires once the finger has stayed put for
 * HOLD_MS. Moving more than a few pixels (a scroll) calls it off, and the tap
 * that ends a hold is swallowed, so it doesn't also open a photo or a link.
 */
function useLongPress(onHold: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      if (e.pointerType !== "touch") return;
      held.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        start.current = null;
        held.current = true;
        onHold();
      }, HOLD_MS);
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture(e: MouseEvent<HTMLDivElement>) {
      if (!held.current) return;
      held.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    // Android's own long-press menu, and iOS's text selection, would fight it.
    onContextMenu(e: MouseEvent<HTMLDivElement>) {
      if (window.matchMedia("(hover: none)").matches) e.preventDefault();
    },
  };
}

/**
 * The message's reactions as pills with counts, in our set's order; tapping
 * one adds or takes back your own. The last pill opens the six to choose from.
 */
function Reactions() {
  const { message, handleReaction } = useMessageContext("Reactions");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groups = message.reaction_groups ?? {};
  const mine = new Set((message.own_reactions ?? []).map((r) => r.type));
  const given = REACTION_LIST.filter((r) => (groups[r.type]?.count ?? 0) > 0);

  // Close the picker on a click anywhere else, or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: globalThis.MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (given.length === 0) return null;

  const react = (type: string) => (e: MouseEvent<HTMLButtonElement>) => {
    setOpen(false);
    void handleReaction(type, e);
  };

  return (
    <div ref={ref} className="relative mt-1.5 flex flex-wrap gap-1.5">
      {given.map((r) => (
        <button
          key={r.type}
          type="button"
          aria-pressed={mine.has(r.type)}
          aria-label={`${r.name}, ${groups[r.type]?.count}`}
          onClick={react(r.type)}
          className={`flex h-7 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold ${
            mine.has(r.type)
              ? "border-violet-500/50 bg-violet-500/10 dark:border-violet-400/60 dark:bg-violet-500/20"
              : "border-black/[0.08] bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.07]"
          }`}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span aria-hidden="true">{groups[r.type]?.count}</span>
        </button>
      ))}
      <button
        type="button"
        aria-label="Add a reaction"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-9 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.04] text-zinc-500 dark:border-white/10 dark:bg-white/[0.07] dark:text-zinc-400"
      >
        <SmilePlus size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Reactions"
          className="absolute bottom-full left-0 z-10 mb-2 flex gap-0.5 rounded-full bg-white p-1 shadow-[0_4px_24px_rgba(0,0,0,0.16)] dark:bg-[#25292E] dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
        >
          {REACTION_LIST.map((r) => (
            <button
              key={r.type}
              type="button"
              role="menuitem"
              aria-label={r.name}
              onClick={react(r.type)}
              className={`flex size-10 items-center justify-center rounded-full text-[22px] hover:bg-black/5 dark:hover:bg-white/10 ${
                mine.has(r.type) ? "bg-violet-500/15" : ""
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
