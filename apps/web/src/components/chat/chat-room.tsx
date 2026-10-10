"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ImageIcon } from "lucide-react";
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  SimpleAttachmentSelector,
  Thread,
  Window,
  WithComponents,
  useCreateChatClient,
  type DateSeparatorProps,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import "./chat-room.css";
import { getChatToken, markChatSeen } from "@/app/actions/chat";
import { RoomHeader, ThreadHeader } from "@/components/chat/chat-headers";
import { MessageRow } from "@/components/chat/message-row";
import { REACTIONS } from "@/components/chat/reactions";

/**
 * The chat room, in the Ladder-style design (plan.md → Group Chat; the Group
 * Chat canvas): our own message rows, headers and day separators around
 * Stream's message list, threads and composer. The page has already put the
 * viewer in the room; this connects with a token from getChatToken() (passed
 * as the provider, so Stream asks again as each one runs out) and disconnects
 * when the page is left.
 *
 * The photo button offers images to members and images or video to trainers.
 * That's only the picker — the server-side check is still to come (plan.md).
 *
 * Light or dark follows the site's appearance (the `dark` class on <html>),
 * with the violet accent — see chat-room.css.
 */
export function ChatRoom({
  apiKey,
  user,
  room,
  trainer,
}: {
  apiKey: string;
  user: { id: string; name: string; image?: string };
  room: { type: string; id: string };
  trainer: boolean;
}) {
  const client = useCreateChatClient({ apiKey, tokenOrProvider: getChatToken, userData: user });
  const channel = useMemo(() => client?.channel(room.type, room.id), [client, room.type, room.id]);
  const dark = useSyncExternalStore(subscribeDark, isDark, () => false);

  // Whatever's in the room counts as seen when the member leaves or puts the
  // chat away, which clears the Chat tab's dot (lib/chat/dot-server.ts). The
  // page notes it on opening too.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void markChatSeen();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void markChatSeen();
    };
  }, []);

  // What the photo button may pick. Composers pick this up whenever it changes.
  useEffect(() => {
    if (!client) return;
    const acceptedFiles = trainer ? ["image/*", "video/*"] : ["image/*"];
    client.setMessageComposerSetupFunction(({ composer }) => {
      composer.updateConfig({ attachments: { acceptedFiles } });
    });
    return () => client.setMessageComposerSetupFunction(null);
  }, [client, trainer]);

  if (!client || !channel) {
    return <div role="status" aria-label="Loading" className="h-full animate-pulse bg-zinc-50 dark:bg-white/[0.03]" />;
  }

  return (
    <div className="mm-chat h-full">
      <Chat client={client} theme={dark ? "str-chat__theme-dark" : "str-chat__theme-light"}>
        <WithComponents
          overrides={{
            MessageUI: MessageRow,
            ThreadHeader,
            DateSeparator: DaySeparator,
            reactionOptions: REACTIONS,
            // One tap opens the photo picker, rather than a menu of files, polls and locations.
            AttachmentSelector: SimpleAttachmentSelector,
            AttachmentSelectorInitiationButtonContents: PhotoIcon,
            // A reply stays in its thread: no "Also send to channel" box.
            SendToChannelCheckbox: Nothing,
          }}
        >
          <Channel channel={channel}>
            <Window>
              <RoomHeader />
              <MessageList />
              <MessageComposer />
            </Window>
            <Thread />
          </Channel>
        </WithComponents>
      </Chat>
    </div>
  );
}

/**
 * Between days: a hairline either side of "Today", "Yesterday" or the date.
 * Scrolled past one, Stream pins the day at the top of the list (`floating`):
 * there it's a small pill, positioned by Stream's own floating class.
 */
function DaySeparator({ date, floating }: DateSeparatorProps) {
  if (floating) {
    return (
      <div className="str-chat__date-separator--floating pt-2">
        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-[0_2px_10px_rgba(0,0,0,0.12)] backdrop-blur dark:bg-[#25292E]/90 dark:text-zinc-300">
          {dayLabel(date)}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
      <span aria-hidden="true" className="h-px flex-1 bg-zinc-200 dark:bg-white/15" />
      {dayLabel(date)}
      <span aria-hidden="true" className="h-px flex-1 bg-zinc-200 dark:bg-white/15" />
    </div>
  );
}

function dayLabel(date: Date): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function PhotoIcon() {
  return <ImageIcon size={20} aria-hidden="true" />;
}

function Nothing() {
  return null;
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

/** Switch appearance (and Automatic following the device) toggle the class. */
function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
