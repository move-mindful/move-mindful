import { RoomHeader } from "@/components/chat/chat-headers";

/** Widths of the placeholder lines, so the rows don't look stamped out. */
const LINES = ["62%", "85%", "48%", "74%"];

/**
 * The chat while it gets ready, in its own shape: the header with its back
 * arrow, a few message rows blocked in, and the composer. One placeholder for
 * every stage — the page loading (chat/loading.tsx), connecting to Stream and
 * the room loading (chat-room.tsx) — so it hands straight over to the chat
 * rather than flicking from one skeleton to another.
 */
export function ChatSkeleton() {
  return (
    <div role="status" aria-label="Loading the chat" className="flex h-full flex-col md:mx-auto md:max-w-[720px]">
      <RoomHeader />
      <div className="flex min-h-0 flex-1 animate-pulse flex-col justify-end gap-5 overflow-hidden px-4 pb-4">
        {LINES.map((width, i) => (
          <div key={i} className="flex gap-3">
            <div className="size-9 shrink-0 rounded-full bg-zinc-200/80 dark:bg-white/10" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3.5 w-24 rounded bg-zinc-200/80 dark:bg-white/10" />
              <div className="h-3.5 rounded bg-zinc-100 dark:bg-white/[0.06]" style={{ width }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 px-4 pt-2 pb-4">
        <div className="size-11 shrink-0 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
        <div className="h-11 flex-1 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}
