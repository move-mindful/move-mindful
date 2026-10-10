"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Menu, type LucideIcon } from "lucide-react";
import { NavDot, useChatDot } from "@/components/chat/chat-dot";
import { MoreMenu } from "@/components/more-menu";
import { isChatPage, isCurrent, navItems, type NavItem } from "@/components/nav-items";

/**
 * The phone navigation: a floating, frosted tab bar along the bottom, in the
 * style of iOS apps, on every signed-in page (the sidebar takes over from
 * tablet width up). Signed-in only.
 *
 * The sections, then ☰ More — the same menu as the sidebar's, as a sheet from
 * the bottom (MoreSheet). Account isn't a tab: it's the photo in the phone
 * header.
 */
export function TabBar({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const chatDot = useChatDot();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // The chat's back arrow is the way out of it, so it gets the whole screen.
  if (isChatPage(pathname)) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden">
        <nav
          aria-label="Main"
          className="pointer-events-auto flex max-w-full items-center rounded-full border border-black/[0.06] bg-white/75 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08] dark:bg-[#25292E]/75 dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        >
          {navItems(admin).map((t) => {
            const on = isCurrent(t, pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className="flex w-[72px] min-w-0 shrink"
              >
                <TabFace tab={t} on={on} dot={t.href === "/chat" && chatDot} />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            className="flex w-[72px] min-w-0 shrink"
          >
            <TabLook icon={Menu} label="More" lit={menuOpen} />
          </button>
        </nav>
      </div>

      {menuOpen && <MoreSheet admin={admin} onClose={close} />}
    </>
  );
}

/** How long the sheet takes to slide away or spring back, in ms. */
const SETTLE_MS = 220;

/**
 * The More menu on a phone: a sheet from the bottom that a downward swipe
 * dismisses, as iOS sheets do — from anywhere on it, not just the grabber.
 * Dragged past a quarter of its height, or flicked, it slides away; less, and
 * it springs back. A tap on the dimmed page behind closes it too.
 *
 * A drag only starts once the finger has moved down a few pixels, so taps on
 * the rows still work — and the click that ends a drag is swallowed, so a
 * swipe that began on a row never opens it.
 */
function MoreSheet({ admin, onClose }: { admin: boolean; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close menu"
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
        <MoreMenu admin={admin} variant="sheet" onClose={onClose} />
      </div>
    </div>
  );
}

/** A section tab — lit when it's the current page, or the moment it's tapped. */
function TabFace({ tab, on, dot }: { tab: NavItem; on: boolean; dot: boolean }) {
  // Inside the Link: true while its navigation is under way, so a tap shows at
  // once even when the page takes a moment (a slow connection, say).
  const { pending } = useLinkStatus();
  return <TabLook icon={tab.icon} label={tab.label} lit={on || pending} dot={dot} />;
}

function TabLook({ icon: Icon, label, lit, dot = false }: { icon: LucideIcon; label: string; lit: boolean; dot?: boolean }) {
  return (
    <span
      className={`flex w-full flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-medium transition-colors ${
        lit
          ? "bg-black/[0.07] text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
          : "text-zinc-500 active:bg-black/[0.04] dark:text-zinc-400 dark:active:bg-white/[0.06]"
      }`}
    >
      <span className="relative flex">
        <Icon size={22} strokeWidth={lit ? 2.3 : 1.9} aria-hidden="true" />
        {/* Ringed in the bar's own colour, as on the Group Chat canvas. */}
        {dot && <NavDot ringClass="ring-white dark:ring-[#25292E]" />}
      </span>
      {label}
    </span>
  );
}
