"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { TutorialMode } from "@move-mindful/core";
import { ChevronLeft, ChevronRight, List, Pause, Settings, WatchTutorial } from "./icons";
import { PausedPicture, Row, settingsPage, type Page } from "./gesture-guide";
import { TAP_ZONES } from "./player-screens";

/**
 * The first-run guide for the desktop "theater" layout (wide landscape
 * screens, iPads held sideways included): a dialog over the dimmed player
 * rather than the phone guide's full-screen card, and four pages instead of
 * six — the controls here are labelled buttons and keys, not taps and swipes.
 * Moving around, the buttons beside the video, watching a tutorial, and last
 * how tutorials and auto-advance are set, shared with the phone guide.
 *
 * Shown and remembered like the phone guide, but separately
 * (`seenDesktopGuide`): someone who's learned one hasn't learned the other.
 * ← and → turn the pages; Esc closes it (the player handles that).
 */

const LIT = "bg-[#A99CFF]/25 text-[#C9C0FF]";

const PAGES: Page[] = [
  {
    title: "Moving around",
    picture: <LayoutDiagram focus="move" />,
    rows: [
      {
        icon: <ChevronRight size={20} />,
        tint: LIT,
        title: "Back and next",
        text: "The arrows beside the video, or click either side of it.",
      },
      { icon: <Pause size={18} />, title: "Pause", text: "Click the middle of the video." },
      { icon: <KeyboardIcon />, title: "On a keyboard", text: "← and → to move, Space to pause, Esc to close a panel." },
    ],
  },
  {
    title: "Your buttons",
    picture: <LayoutDiagram focus="buttons" />,
    rows: [
      { icon: <Settings size={18} />, tint: LIT, title: "Settings", text: "Tutorials, instructor audio and auto-advance." },
      { icon: <List size={18} />, title: "Workout", text: "Every exercise and where you are. Jump to any of them." },
      { icon: <Pause size={18} />, title: "Pause", text: "Restart a set, watch the tutorial, or end the workout." },
    ],
  },
  {
    title: "Watch the tutorial any time",
    picture: <PausedPicture />,
    rows: [
      { icon: <Pause size={18} />, title: "Pause", text: "Click the middle of the video, or press Space." },
      {
        icon: <WatchTutorial size={18} />,
        tint: LIT,
        title: "Watch the tutorial",
        text: "From the pause screen, any time.",
      },
    ],
  },
];

export function DesktopGuide({
  settings,
  onSettings,
  onDone,
  startOnSettings = false,
}: {
  /** How tutorials and auto-advance are set now, for the last page. */
  settings: { mode: TutorialMode; autoAdvance: boolean };
  /** "Change settings" on the last page: close the guide and open Settings. */
  onSettings: () => void;
  onDone: () => void;
  /** Open on the last page — coming back from Settings after "Change settings". */
  startOnSettings?: boolean;
}) {
  const pages = [...PAGES, settingsPage(settings)];
  const count = pages.length;
  const [page, setPage] = useState(startOnSettings ? count - 1 : 0);
  const current = pages[page];
  const last = page === count - 1;

  // ← and → turn the pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") setPage((p) => Math.min(p + 1, count - 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#08080F]/75 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="How to use the player"
    >
      <div className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[28px] bg-[#1A1A34] shadow-[0_24px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
        <div className="flex h-[240px] shrink-0 items-center justify-center bg-white/[0.04]" aria-hidden="true">
          {current.picture}
        </div>
        <div className="flex flex-col gap-4 px-7 pb-7 pt-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
              How it works · {page + 1} of {count}
            </span>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{current.title}</h2>
          </div>
          <div className="flex flex-col gap-3.5">
            {current.rows.map((r) => (
              <Row key={`${r.title}-${r.text}`} icon={r.icon} tint={r.tint ?? "bg-white/[0.14]"} title={r.title} text={r.text} />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            {/* Skipping still lands on the settings, as on phones. */}
            <button
              type="button"
              onClick={() => setPage(page === 0 ? count - 1 : page - 1)}
              className="h-12 px-2 text-base font-semibold text-white/75 transition hover:text-white"
            >
              {page === 0 ? "Skip" : "Back"}
            </button>
            <span className="flex-1" />
            {last && (
              <button
                type="button"
                onClick={onSettings}
                className="flex h-12 items-center gap-2 rounded-full bg-white/[0.12] px-5 text-base font-semibold transition hover:bg-white/20"
              >
                <Settings size={18} />
                Change settings
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? onDone() : setPage(page + 1))}
              className="h-12 min-w-[120px] rounded-full bg-white px-7 text-base font-semibold text-[#14142B] transition hover:bg-white/90"
            >
              {last ? "Close" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The theater layout in miniature — the info panel, the arrows either side of
 * the video, its three click zones (as wide as the real ones) and the button
 * column — with the part the page is about lit up.
 */
function LayoutDiagram({ focus }: { focus: "move" | "buttons" }) {
  const move = focus === "move";
  const round = (on: boolean) =>
    `flex size-8 items-center justify-center rounded-full ${on ? "bg-[#A99CFF]/30 text-white ring-2 ring-[#A99CFF]" : "bg-white/10 text-white/50"}`;
  return (
    <div className="flex items-center gap-3">
      {/* The exercise info, left of the video. */}
      <div className="flex w-[88px] flex-col gap-1.5 opacity-50">
        <span className="h-2 w-2/3 rounded bg-white/50" />
        <span className="h-4 w-full rounded bg-white/70" />
        <span className="h-2 w-5/6 rounded bg-white/30" />
        <span className="mt-2 h-5 w-full rounded-full bg-white/80" />
      </div>
      <span className={round(move)}>
        <ChevronLeft size={16} />
      </span>
      {/* The video, with its click zones. */}
      <div className="flex h-[180px] w-[102px] overflow-hidden rounded-xl bg-[#2A2A4E] ring-1 ring-white/15">
        <Zone width={TAP_ZONES.back} tint={move ? "rgba(76,199,224,0.35)" : undefined} divider>
          <ChevronLeft size={14} />
        </Zone>
        <Zone width={TAP_ZONES.pause} tint={move ? "rgba(255,255,255,0.16)" : undefined} divider>
          <Pause size={12} />
        </Zone>
        <Zone width={TAP_ZONES.next} tint={move ? "rgba(169,156,255,0.35)" : undefined}>
          <ChevronRight size={14} />
        </Zone>
      </div>
      <span className={round(move)}>
        <ChevronRight size={16} />
      </span>
      {/* The buttons column. */}
      <div className="ml-1 flex flex-col items-center gap-2">
        {(
          [
            ["Settings", <Settings key="s" size={14} />],
            ["Workout", <List key="w" size={14} />],
            ["Pause", <Pause key="p" size={12} />],
          ] as const
        ).map(([label, icon]) => (
          <span key={label} className="flex flex-col items-center gap-0.5">
            <span className={round(!move)}>{icon}</span>
            <span className={`text-[10px] font-medium ${move ? "text-white/40" : "text-white/85"}`}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Zone({
  width,
  tint,
  divider = false,
  children,
}: {
  width: number;
  tint?: string;
  divider?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-center ${tint ? "text-white" : "text-white/25"} ${
        divider ? "border-r border-dashed border-white/40" : ""
      }`}
      style={{ flex: `0 0 ${width * 100}%`, background: tint }}
    >
      {children}
    </div>
  );
}

function KeyboardIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}
