"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

/** How long the sheet takes to slide away or spring back, in ms. */
const SETTLE_MS = 220;

/**
 * A sheet from the bottom of a phone's screen that a downward swipe dismisses,
 * as iOS sheets do — from anywhere on it, not just the grabber. Dragged past a
 * quarter of its height, or flicked, it slides away; less, and it springs
 * back. A tap on the dimmed page behind, or Escape, closes it too. The phone's
 * More menu (TabBar) and a chat message's options (MessageSheet) use it.
 *
 * A drag only starts once the finger has moved down a few pixels, so taps on
 * the rows still work — and the click that ends a drag is swallowed, so a
 * swipe that began on a row never opens it.
 */
export function BottomSheet({
  onClose,
  label,
  className = "",
  children,
}: {
  onClose: () => void;
  /** What the sheet is, for screen readers ("Menu", "Message options"). */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const drag = useRef<{
    id: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
    active: boolean;
  } | null>(null);
  const dragged = useRef(false);
  const [offset, setOffset] = useState(0);
  const [height, setHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);

  // Close once the slide-away has played.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, SETTLE_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (closing || e.button !== 0) return;
    dragged.current = false;
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      active: false,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (dy < 8) return; // a tap, or not downward: leave it to the rows
      d.active = true;
      dragged.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setHeight(e.currentTarget.offsetHeight);
      setDragging(true);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    setOffset(Math.max(0, dy));
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.active) return;
    setDragging(false);
    const dy = e.clientY - d.startY;
    const sheetHeight = e.currentTarget.offsetHeight;
    // A flick is about half a pixel a millisecond, downward.
    if (e.type === "pointerup" && (dy > sheetHeight / 4 || d.velocity > 0.5)) {
      setOffset(sheetHeight);
      setClosing(true);
    } else {
      setOffset(0);
    }
  }

  const transition = dragging ? "none" : `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out`;

  return (
    // Nothing on it selectable, and no iPhone callout — a finger still down
    // from the hold that opened it lands here (MessageSheet).
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed inset-0 z-50 select-none [-webkit-touch-callout:none] ${className}`}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 touch-none bg-black/40"
        style={{ opacity: height ? 1 - Math.min(offset / height, 1) : 1, transition }}
      />
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute inset-x-0 bottom-0 animate-[sheet-up_0.25s_ease-out] touch-none rounded-t-[20px] bg-white px-2 pt-2 pb-[max(32px,env(safe-area-inset-bottom))] select-none dark:bg-[#25292E]"
        style={{ transform: offset ? `translateY(${offset}px)` : undefined, transition }}
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-2 block h-[5px] w-9 rounded-full bg-zinc-300 dark:bg-white/20"
        />
        {children}
      </div>
    </div>
  );
}
