"use client";

import { LoadingChannel } from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";
import "./chat-room.css";
import { RoomHeader } from "@/components/chat/chat-headers";

/**
 * The chat while it gets ready: our header with its back arrow over Stream's
 * own loading skeleton (its message bubbles and composer; its header
 * placeholder hidden in chat-room.css). The same at every stage — the page
 * loading (chat/loading.tsx), connecting to Stream and the room loading
 * (chat-room.tsx) — so it hands straight over to the chat.
 */
export function RoomLoading() {
  return (
    <div role="status" aria-label="Loading the chat" className="flex h-full flex-col">
      <RoomHeader floating={false} />
      <div className="min-h-0 flex-1">
        <LoadingChannel />
      </div>
    </div>
  );
}

/** RoomLoading on its own, before Stream's components are on the page (they bring the `str-chat` frame it sits in). */
export function ChatSkeleton() {
  return (
    <div className="mm-chat h-full">
      <div className="str-chat h-full">
        <RoomLoading />
      </div>
    </div>
  );
}
