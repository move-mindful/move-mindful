"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// A line of text that scrolls when it doesn't fit — the Up next card's and
// pill's. Text that fits stays put. Text that doesn't waits a moment, glides
// left until its end shows, waits again, then starts over from the top: a
// slow, readable pace, with its edges fading while it's cut off. A new text
// starts from its first word. With Reduce motion on, it's trimmed with "…" instead.

/** Pixels a second it glides at. */
const SPEED = 30;
/** How long it rests at the start, then at the end (ms). */
const HOLD_START = 1600;
const HOLD_END = 1400;
/** The fade at each edge while it's cut off. */
const FADE = "linear-gradient(to right, transparent, #000 10px, #000 calc(100% - 10px), transparent)";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCE_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCE_MOTION).matches,
    () => false,
  );
}

/**
 * `className` styles the line (size, weight, colour, and `min-w-0` in a flex
 * row). The fades sit in 10px of padding either side, which the line's
 * negative margins give back, so the text lines up as plain text would.
 */
export function Marquee({ text, className = "" }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  // How far it has to travel: how much wider the text is than its room (0: it fits).
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    // Layout widths, which the glide (a transform) doesn't change. The observer also reports straight away.
    const measure = () => setShift(Math.max(0, Math.ceil(i.offsetWidth - b.clientWidth)));
    const observer = new ResizeObserver(measure);
    observer.observe(b);
    observer.observe(i);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    const i = inner.current;
    if (!i || reduced || shift <= 0) return;
    const travel = (shift / SPEED) * 1000;
    const total = HOLD_START + travel + HOLD_END;
    const moved = `translateX(${-shift}px)`;
    const glide = i.animate(
      [
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: HOLD_START / total, easing: "ease-in-out" },
        { transform: moved, offset: (HOLD_START + travel) / total },
        { transform: moved, offset: 1 },
      ],
      { duration: total, iterations: Infinity },
    );
    return () => glide.cancel();
  }, [shift, text, reduced]);

  if (reduced) return <span className={`block truncate ${className}`}>{text}</span>;
  const fade = shift > 0 ? { maskImage: FADE, WebkitMaskImage: FADE } : undefined;
  return (
    <span ref={box} className={`-mx-2.5 block overflow-hidden whitespace-nowrap ${className}`} style={fade}>
      <span ref={inner} className="inline-block px-2.5">
        {text}
      </span>
    </span>
  );
}
