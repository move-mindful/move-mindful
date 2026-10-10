"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GalleryProps, ModalCloseEvent, ModalProps } from "stream-chat-react";

/**
 * Tapping a photo in the chat opens it full screen, in a sheet styled like
 * the workout player's: the same dark panel and grabber, a ✕ to close, and a
 * swipe down, or the iPhone's swipe back, to go back to the chat. No header
 * and no download button, unlike Stream's own viewer, and the photo runs
 * edge to edge. Several photos in one message page sideways.
 *
 * Stream opens its viewer as a Modal holding a Gallery; message-row.tsx swaps
 * in these two, for attachments only (MEDIA_VIEWER).
 */

/** How long the sheet takes to slide away, in ms. */
const SLIDE_MS = 220;
/** While the sheet is open the address has `?photo`, so going back closes it. */
const PARAM = "photo";

/** Stream's Modal, as a full-screen sheet. Rendered into the signed-in shell, so it covers the whole screen. */
export function MediaSheet({ open, onClose, children }: PropsWithChildren<ModalProps>) {
  if (!open) return null;
  const shell = document.querySelector("[data-app-shell]");
  if (!shell) return null;
  // Stream's close handler takes the event that closed it, but doesn't use it.
  return createPortal(<Frame onClose={() => onClose?.(undefined as unknown as ModalCloseEvent)}>{children}</Frame>, shell);
}

function Frame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Slide away, then close — and take the sheet's step back off the history,
  // unless going back is what closed it (`popped`).
  const closing = useRef(false);
  const dismiss = useCallback((popped = false) => {
    if (closing.current) return;
    closing.current = true;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!instant && panel && backdrop) {
      panel.style.transition = `transform ${SLIDE_MS}ms ease-in`;
      panel.style.transform = "translateY(100%)";
      backdrop.style.transition = `opacity ${SLIDE_MS}ms ease-in`;
      backdrop.style.opacity = "0";
    }
    window.setTimeout(
      () => {
        if (!popped && hasParam()) window.history.back();
        close.current();
      },
      instant ? 0 : SLIDE_MS,
    );
  }, []);

  // Slide in: start below the screen, let that frame paint, then rise.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel || !backdrop || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    panel.style.transform = "translateY(100%)";
    backdrop.style.opacity = "0";
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        panel.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
        panel.style.transform = "";
        backdrop.style.transition = "opacity 250ms ease-out";
        backdrop.style.opacity = "";
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  // The sheet is a step in history, as a thread is (thread-history.tsx), so
  // the iPhone's swipe back — or the browser's Back — closes it.
  const pushed = useRef(false);
  useEffect(() => {
    if (!pushed.current) {
      pushed.current = true;
      // A `?photo` left over from a reload goes first, so closing never steps back out of the chat.
      if (hasParam()) setParam(false, "replace");
      setParam(true, "push");
    }
    const onPop = () => {
      if (!hasParam()) dismiss(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dismiss]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dismiss]);

  useSwipeDown(panelRef, backdropRef, dismiss);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      // The sheet sits inside the message row in React's tree: keep a hold on
      // the photo from opening the message's own options underneath.
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 select-none [-webkit-touch-callout:none]"
    >
      <div ref={backdropRef} aria-hidden="true" onClick={() => dismiss()} className="absolute inset-0 bg-black/55" />
      <section
        ref={panelRef}
        className="absolute inset-x-0 top-[max(12px,calc(env(safe-area-inset-top)+8px))] bottom-0 flex flex-col rounded-t-[28px] border-t border-white/[0.08] bg-[#16191E] pt-2.5 pb-[max(16px,env(safe-area-inset-bottom))] text-white will-change-transform md:inset-10 md:rounded-[28px] md:border md:pt-4"
      >
        <div aria-hidden="true" className="h-[5px] w-9 shrink-0 self-center rounded-full bg-white/25 md:hidden" />
        <div className="flex shrink-0 justify-end px-4 pt-1 pb-2">
          <button
            type="button"
            aria-label="Close"
            autoFocus
            onClick={() => dismiss()}
            className="flex size-9 items-center justify-center rounded-full bg-white/10"
          >
            <X size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

/**
 * Stream's Gallery, as the sheet's contents: each photo (or video) as large
 * as the sheet allows, edge to edge, paging sideways when there are several,
 * with dots for where you are.
 */
export function MediaPager({ items, initialIndex = 0 }: GalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initialIndex);

  // Open on the one that was tapped.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = initialIndex * track.clientWidth;
  }, [initialIndex]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={trackRef}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div key={i} className="flex w-full shrink-0 snap-center items-center justify-center">
            {item.videoUrl ? (
              <video
                src={item.videoUrl}
                poster={item.videoThumbnailUrl}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a member's upload on Stream's CDN, at its own size
              <img src={item.imageUrl} alt={item.alt ?? "Photo"} draggable={false} className="h-full w-full object-contain" />
            )}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div aria-hidden="true" className="flex shrink-0 justify-center gap-1.5 pt-3">
          {items.map((_, i) => (
            <span key={i} className={`size-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function hasParam() {
  return new URLSearchParams(window.location.search).has(PARAM);
}

/** Put `?photo` in the address, or take it out; Next.js keeps its router in step with these. */
function setParam(on: boolean, mode: "push" | "replace") {
  const url = new URL(window.location.href);
  if (on) url.searchParams.set(PARAM, "");
  else url.searchParams.delete(PARAM);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

/**
 * Drag the sheet down to close it, as the player's sheets do: it follows the
 * finger, and past 90px — or on a quick flick — slides away; short of that it
 * springs back. A sideways swipe (to the next photo) or a two-finger touch is
 * left alone.
 */
function useSwipeDown(
  panelRef: React.RefObject<HTMLElement | null>,
  backdropRef: React.RefObject<HTMLElement | null>,
  dismiss: () => void,
) {
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let start: { x: number; y: number; t: number } | null = null;
    let way: "down" | "other" | null = null;
    let dy = 0;

    const place = (y: number, animate: boolean) => {
      const ease = animate ? "200ms ease-out" : "none";
      panel.style.transition = animate ? `transform ${ease}` : "none";
      panel.style.transform = y ? `translateY(${y}px)` : "";
      const backdrop = backdropRef.current;
      if (backdrop) {
        backdrop.style.transition = animate ? `opacity ${ease}` : "none";
        backdrop.style.opacity = String(Math.max(0, 1 - y / panel.offsetHeight));
      }
    };
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp } : null;
      way = null;
      dy = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - start.x;
      dy = e.touches[0].clientY - start.y;
      if (!way) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        way = dy > 0 && dy > Math.abs(dx) ? "down" : "other";
      }
      if (way !== "down") return;
      e.preventDefault();
      place(Math.max(0, dy), false);
    };
    const onEnd = (e: TouchEvent) => {
      if (start && way === "down") {
        const flick = dy / Math.max(1, e.timeStamp - start.t) > 0.5;
        if (dy > 90 || (flick && dy > 30)) dismiss();
        else place(0, true);
      }
      start = null;
      way = null;
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [panelRef, backdropRef, dismiss]);
}
