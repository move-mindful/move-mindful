"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useChannelActionContext, useChannelStateContext } from "stream-chat-react";

/**
 * An open thread is a step in the browser's history (`/chat?thread=<id>`), so
 * going back — the iPhone's swipe from the left edge, the browser's Back —
 * closes the thread onto the room rather than leaving the chat. Stream opens
 * threads without touching the address, so this keeps the two in step:
 *
 * - a thread opening adds the step (a different one opening on desktop
 *   replaces it, so there's never more than one);
 * - going back past it closes the thread;
 * - the thread closing any other way (the header's arrow or ✕ go through
 *   leaveThread, below) takes the step back off.
 *
 * Renders nothing; lives inside Stream's <Channel>.
 */
export function ThreadHistory() {
  const { thread } = useChannelStateContext("ThreadHistory");
  const { closeThread } = useChannelActionContext("ThreadHistory");
  const param = useSearchParams().get(PARAM);
  const openId = thread?.id ?? null;
  const prev = useRef<{ open: string | null; param: string | null } | null>(null);

  useEffect(() => {
    const was = prev.current;
    prev.current = { open: openId, param };
    const openChanged = !was || was.open !== openId;
    const paramChanged = !was || was.param !== param;

    // Back or forward through history, the thread itself unchanged.
    if (paramChanged && !openChanged) {
      if (openId && param !== openId) closeThread();
      else if (!openId && param) setThreadParam(null, "replace");
      return;
    }
    if (!openChanged) return;
    if (openId && param !== openId) setThreadParam(openId, param ? "replace" : "push");
    else if (!openId && param) {
      // Closed by Stream itself: take our step back off. On the first render,
      // a ?thread left over from a reload just goes.
      if (was) window.history.back();
      else setThreadParam(null, "replace");
    }
  }, [openId, param, closeThread]);

  return null;
}

/**
 * Leave a thread from its header (the phone's back arrow, the desktop ✕):
 * back through history when the thread has its step, which closes it via
 * ThreadHistory, so the arrow and the swipe do the same thing.
 */
export function leaveThread(closeThread: () => void) {
  if (new URLSearchParams(window.location.search).has(PARAM)) window.history.back();
  else closeThread();
}

const PARAM = "thread";

/** Put the open thread in the address, or take it out; Next.js keeps its router in step with these. */
function setThreadParam(id: string | null, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}
