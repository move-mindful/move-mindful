"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  Thread,
  Window,
  useCreateChatClient,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import "./chat-room.css";
import { getChatToken } from "@/app/actions/chat";

/**
 * The chat room, in Stream's ready-made components: the message list,
 * threads, reactions and the composer. The page has already put the viewer
 * in the room; this connects with a token from getChatToken() (passed as the
 * provider, so Stream asks again as each one runs out) and disconnects when
 * the page is left.
 *
 * Light or dark follows the site's appearance (the `dark` class on <html>),
 * with the violet accent — see chat-room.css.
 */
export function ChatRoom({
  apiKey,
  user,
  room,
}: {
  apiKey: string;
  user: { id: string; name: string; image?: string };
  room: { type: string; id: string };
}) {
  const client = useCreateChatClient({ apiKey, tokenOrProvider: getChatToken, userData: user });
  const channel = useMemo(() => client?.channel(room.type, room.id), [client, room.type, room.id]);
  const dark = useSyncExternalStore(subscribeDark, isDark, () => false);

  if (!client || !channel) {
    return <div role="status" aria-label="Loading" className="h-full animate-pulse bg-zinc-50 dark:bg-white/[0.03]" />;
  }

  return (
    <div className="mm-chat h-full">
      <Chat client={client} theme={dark ? "str-chat__theme-dark" : "str-chat__theme-light"}>
        <Channel channel={channel}>
          {/* No header bar: there's one room, and the site's own header names the page. */}
          <Window>
            <MessageList />
            <MessageComposer />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
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
