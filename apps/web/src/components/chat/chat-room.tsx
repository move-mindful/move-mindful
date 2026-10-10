"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { ImageIcon } from "lucide-react";
import {
  Channel,
  Chat,
  LoadingChannel,
  Message,
  MessageComposer,
  MessageList,
  SimpleAttachmentSelector,
  Thread,
  Window,
  WithComponents,
  useCreateChatClient,
  type DateSeparatorProps,
  type MessageProps,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import "./chat-room.css";
import { getChatToken, markChatSeen } from "@/app/actions/chat";
import { RoomHeader, ThreadHeader } from "@/components/chat/chat-headers";
import { MessageRow } from "@/components/chat/message-row";
import { REACTIONS } from "@/components/chat/reactions";
import { ThreadHistory } from "@/components/chat/thread-history";

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

  // On a phone, the bar around the notch in the chat's own background: the
  // iPhone colours it from the theme-color. The page declares one to suit the
  // device's light or dark (page.tsx); this holds it to the appearance chosen
  // on the site, and keeps holding it — Next.js puts back its own theme-color
  // whenever it redraws the head (a thread opening changes the address, for
  // one), which is what turned the bar white. Touch screens only: desktop
  // Safari would tint its tab bar too.
  useEffect(() => {
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    const color = dark ? "#0C1014" : "#FFFFFF";
    const metas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const before = metas().map((m) => [m, m.content] as const);
    const hold = () => {
      for (const m of metas()) if (m.content !== color) m.content = color;
    };
    hold();
    const watch = new MutationObserver(hold);
    watch.observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ["content"] });
    return () => {
      watch.disconnect();
      // Leaving the chat, Next.js draws the next page's own; put back what it drew here meanwhile.
      for (const [m, content] of before) if (m.isConnected) m.content = content;
    };
  }, [dark]);

  // The composers float over the lists (chat-room.css), so each panel — the
  // room, and a thread — gets its composer's height as --mm-foot, for its list
  // to finish clear of it however tall it grows (more lines, a photo preview).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sizes = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const panel = entry.target.parentElement;
        panel?.style.setProperty("--mm-foot", `${Math.ceil(entry.target.getBoundingClientRect().height)}px`);
      }
    });
    const watch = () =>
      root
        .querySelectorAll(":is(.str-chat__main-panel, .str-chat__thread-container) > .str-chat__message-composer-container")
        .forEach((el) => sizes.observe(el));
    watch();
    // A thread's composer arrives when the thread opens.
    const added = new MutationObserver(watch);
    added.observe(root, { childList: true, subtree: true });
    return () => {
      sizes.disconnect();
      added.disconnect();
    };
  }, [client, channel]);

  // The iPhone's keyboard shrinks what's visible but not the page, so the chat
  // — pinned to the full screen — would keep its composer down behind the
  // keyboard. On touch screens, size the chat to the visible area instead
  // (and follow it as Safari pans), so the composer sits just above the
  // keyboard; a list that was at its latest message stays there.
  useEffect(() => {
    const root = rootRef.current;
    const view = window.visualViewport;
    if (!root || !view || !isTouch()) return;
    const fit = () => {
      const lists = [...root.querySelectorAll<HTMLElement>(".str-chat__message-list")];
      const atEnd = lists.map((l) => l.scrollHeight - l.scrollTop - l.clientHeight < 48);
      root.style.height = `${view.height}px`;
      root.style.transform = view.offsetTop ? `translateY(${view.offsetTop}px)` : "";
      lists.forEach((l, i) => {
        if (atEnd[i]) l.scrollTop = l.scrollHeight;
      });
    };
    fit();
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    return () => {
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
      root.style.height = "";
      root.style.transform = "";
    };
  }, [client, channel]);

  // No iPhone text selection anywhere in the chat on a touch screen: holding a
  // message opens our sheet, and the iPhone's own hold — which fires a moment
  // later on whatever's under the finger by then, often the sheet's backdrop —
  // would otherwise select the whole page with its Copy / Look Up bar, or win
  // the race and cancel the sheet. The CSS stops most of it (chat-room.css);
  // this catches the rest, wherever it starts. Typing stays selectable.
  useEffect(() => {
    if (!isTouch()) return;
    const stop = (e: Event) => {
      const node = e.target as Node | null;
      const el = node instanceof Element ? node : node?.parentElement;
      if (el?.closest("textarea, input, [contenteditable='true']")) return;
      e.preventDefault();
    };
    document.addEventListener("selectstart", stop);
    return () => document.removeEventListener("selectstart", stop);
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

  // While it connects: Stream's own loading skeleton, as Stream ships it — the
  // same one its Channel shows while the room loads, so the two run together.
  if (!client || !channel) {
    return (
      <div className="mm-chat h-full">
        <div className={`str-chat h-full ${dark ? "str-chat__theme-dark" : "str-chat__theme-light"}`}>
          <LoadingChannel />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="mm-chat h-full">
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
            // A thread opens straight onto its replies, without a "1 reply" bar,
            // and its first post has no "Today" over it.
            ThreadStart: Nothing,
            ThreadHead,
            // Where new messages begin: a quiet "New" line, nothing to dismiss.
            UnreadMessagesSeparator: NewLine,
            UnreadMessagesNotification: Nothing,
          }}
        >
          <Channel channel={channel}>
            <Window>
              <RoomHeader />
              <MessageList />
              <MessageComposer />
            </Window>
            {/* On a phone, opening a thread doesn't pop the keyboard up; tap to type. */}
            <Thread autoFocus={!isTouch()} />
            {/* An open thread is a step in history: swiping back closes it. */}
            <ThreadHistory />
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
function DaySeparator({ date, floating, unread }: DateSeparatorProps) {
  // Stream adds a second day, the same one again, just before the messages
  // that came in since you last looked; the "New" line (NewLine) marks those.
  if (unread) return null;
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

/**
 * Where the messages that came in since you last looked begin, as in Slack:
 * a violet hairline either side of "New". In place of Stream's "1 unread ✕",
 * which stayed until it was dismissed — opening the chat counts it as read,
 * so the line is simply gone the next time.
 */
function NewLine() {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-1 text-xs font-semibold text-violet-700 dark:text-violet-400">
      <span aria-hidden="true" className="h-px flex-1 bg-violet-500/40" />
      New
      <span aria-hidden="true" className="h-px flex-1 bg-violet-500/40" />
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

/** The post a thread starts from, as Stream draws it but without the day above it. */
function ThreadHead(props: MessageProps) {
  return (
    <div className="str-chat__parent-message-li">
      <Message initialMessage threadList {...props} />
    </div>
  );
}

function PhotoIcon() {
  return <ImageIcon size={20} aria-hidden="true" />;
}

function Nothing() {
  return null;
}

/** A phone or tablet: no hover, a finger for a pointer. */
function isTouch() {
  return typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
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
