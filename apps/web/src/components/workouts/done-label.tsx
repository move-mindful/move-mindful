"use client";

import { useSyncExternalStore } from "react";
import { daysAgoLabel } from "@/lib/member/sessions";

const noSubscribe = () => () => {};

/**
 * "Done · 3 days ago", counted in the viewer's own calendar days — so it's
 * worked out in the browser, and the server sends just "Done".
 */
export function DoneLabel({ at }: { at: string }) {
  const ago = useSyncExternalStore(
    noSubscribe,
    () => daysAgoLabel(new Date(at), new Date()),
    () => null,
  );
  return <>Done{ago && ` · ${ago}`}</>;
}
