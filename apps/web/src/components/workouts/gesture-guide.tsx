"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import guideBackground from "./guide-background.webp";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loop,
  Pause,
  Play,
  Settings,
  Timer,
  WatchTutorial,
} from "./icons";
import { TAP_ZONES } from "./player-screens";

/**
 * The first-run guide to the player, over the stage on phones: tapping (the
 * three zones drawn over the video), swiping, watching a tutorial from the
 * pause screen, Settings and the tutorial mode, and auto-advance. Shown once,
 * as the first exercise comes up (see guidePending in the core reducer), and
 * again from Settings. The workout waits while it's open.
 */

interface Page {
  title: string;
  /** What goes above the panel. */
  picture: ReactNode;
  rows: Array<{ icon: ReactNode; tint?: string; title: string; text: string }>;
}

const PAGES: Page[] = [
  {
    title: "Tap to move around",
    picture: <TapZonesPicture />,
    rows: [
      {
        icon: <ChevronLeft size={20} />,
        tint: "bg-[#4CC7E0]/25 text-[#8BE3F2]",
        title: "Tap the left side",
        text: "Go back to previous exercise.",
      },
      { icon: <Pause size={18} />, title: "Tap the middle", text: "Pause. Press play to resume." },
      {
        icon: <ChevronRight size={20} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: "Tap the right side",
        text: "Move to next exercise.",
      },
    ],
  },
  {
    title: "Swipe for more",
    picture: (
      <div className="flex flex-col items-center gap-4">
        <Bubble>
          <ArrowUp size={26} />
        </Bubble>
        <Bubble>
          <ArrowDown size={26} />
        </Bubble>
      </div>
    ),
    rows: [
      { icon: <ArrowUp size={18} />, title: "Swipe up", text: "See workout overview." },
      { icon: <ArrowDown size={18} />, title: "Swipe down", text: "Minimize player controls." },
      { icon: <ArrowUp size={18} />, title: "Swipe up", text: "Expand player controls." },
    ],
  },
  {
    title: "Watch the tutorial any time",
    picture: (
      // A mini pause screen, with Watch the tutorial picked out.
      <div className="flex w-[240px] flex-col items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-white text-[#14142B]">
          <Play size={26} />
        </span>
        <span className="text-lg font-semibold">Paused</span>
        <span className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.12] text-[15px] font-semibold ring-2 ring-[#A99CFF]">
          <WatchTutorial size={18} />
          Watch the tutorial
        </span>
      </div>
    ),
    rows: [
      { icon: <Pause size={18} />, title: "Pause", text: "Tap the middle of the screen." },
      {
        icon: <WatchTutorial size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: "Watch the tutorial",
        text: "From the pause screen, any time.",
      },
    ],
  },
  {
    title: "Settings",
    picture: (
      // The gear, then the tutorial modes.
      <div className="flex flex-col items-center gap-5">
        <Bubble ring>
          <Settings size={24} />
        </Bubble>
        <div className="flex gap-2">
          {["Loop", "Play once", "Off"].map((m, i) => (
            <span
              key={m}
              className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-semibold ${
                i === 0 ? "border-[#A99CFF]/85 bg-[#A99CFF]/[0.14]" : "border-white/[0.18] bg-white/[0.05] text-white/80"
              }`}
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    ),
    rows: [
      {
        icon: <Settings size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: "Settings",
        text: "On the pause screen, top right.",
      },
      { icon: <Loop size={17} />, title: "Tutorial mode", text: "Loop, play once, or off before each new exercise." },
    ],
  },
  {
    title: "Auto-advance",
    picture: (
      // A rep set counting down, with the switch on.
      <div className="flex w-[240px] flex-col items-start gap-3">
        <div className="h-1 w-full overflow-hidden rounded-sm bg-white/30">
          <div className="h-1 w-3/5 rounded-sm bg-[#A99CFF]" />
        </div>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[44px] font-semibold leading-none">10</span>
          <span className="text-xl font-medium">reps</span>
        </span>
        <span className="flex w-full items-center justify-between rounded-2xl bg-white/[0.08] px-3.5 py-2.5 text-[15px] font-semibold">
          Auto-advance
          <span className="relative h-[26px] w-[44px] rounded-full bg-[#A99CFF]">
            <span className="absolute right-0.5 top-0.5 size-[22px] rounded-full bg-white" />
          </span>
        </span>
      </div>
    ),
    rows: [
      {
        icon: <Timer size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: "Auto-advance",
        text: "Turn it on in Settings.",
      },
      {
        icon: <ChevronRight size={20} />,
        title: "Rep sets move on by themselves",
        text: "After the time the reps usually take. Tap to move on sooner.",
      },
      {
        icon: <WatchTutorial size={18} />,
        title: "Tutorials play once",
        text: "Turning it on switches tutorials from loop to play once.",
      },
    ],
  },
];

export function GestureGuide({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const current = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <div className="absolute inset-0 z-30 flex flex-col" role="dialog" aria-modal="true" aria-label="How to use the player">
      {/* The backdrop runs the full height, behind the panel's rounded corners
          too; the pictures sit in the space above the panel, where they show.
          Every page sits on the same darkened, blurred studio photo, so
          nothing on the screen behind shows through; page 1 tints the tap
          zones over it. */}
      <PhotoBackdrop />
      {page === 0 && <TapZonesBackdrop />}

      <div className="relative flex flex-1 items-center justify-center" aria-hidden="true">
        {current.picture}
      </div>

      <section className="relative flex flex-col gap-4 rounded-t-[28px] bg-[#1A1A34] px-5 pb-[max(28px,calc(env(safe-area-inset-bottom)+12px))] pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
            How it works · {page + 1} of {PAGES.length}
          </span>
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{current.title}</h2>
        </div>
        <div className="flex flex-col gap-3.5">
          {current.rows.map((r) => (
            <Row key={`${r.title}-${r.text}`} icon={r.icon} tint={r.tint ?? "bg-white/[0.14]"} title={r.title} text={r.text} />
          ))}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (page === 0 ? onDone() : setPage(page - 1))}
            className="h-[54px] px-4 text-base font-semibold text-white/75"
          >
            {page === 0 ? "Skip" : "Back"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onDone() : setPage(page + 1))}
            className="h-[54px] flex-1 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}

/** A studio photo, darkened and blurred — the guide's background. */
function PhotoBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#14142B]" aria-hidden="true">
      <Image
        src={guideBackground}
        alt=""
        fill
        sizes="100vw"
        className="scale-110 object-cover blur-lg brightness-[0.45]"
      />
      <div className="absolute inset-0 bg-[#14142B]/35" />
    </div>
  );
}

/** Page 1's backdrop: the three tap zones, as wide as they really are, full height. */
function TapZonesBackdrop() {
  return (
    <div className="absolute inset-0 flex" aria-hidden="true">
      <Zone width={TAP_ZONES.back} tint="rgba(76,199,224,0.32)" divider />
      <Zone width={TAP_ZONES.pause} tint="rgba(255,255,255,0.14)" divider />
      <Zone width={TAP_ZONES.next} tint="rgba(169,156,255,0.32)" />
    </div>
  );
}

/** Page 1's labels, each centred over its zone in the space above the panel. */
function TapZonesPicture() {
  return (
    <div className="flex h-full w-full self-stretch">
      <Label width={TAP_ZONES.back}>
        <Tag>
          <ChevronLeft size={16} />
          Back
        </Tag>
      </Label>
      <Label width={TAP_ZONES.pause}>
        <Tag dark>
          <Pause size={14} />
          Pause
        </Tag>
      </Label>
      <Label width={TAP_ZONES.next}>
        <Tag>
          Next
          <ChevronRight size={16} />
        </Tag>
      </Label>
    </div>
  );
}

function Zone({ width, tint, divider = false }: { width: number; tint: string; divider?: boolean }) {
  return (
    <div
      className={divider ? "border-r-2 border-dashed border-white/80" : ""}
      style={{ background: tint, flex: `0 0 ${width * 100}%` }}
    />
  );
}

function Label({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center" style={{ flex: `0 0 ${width * 100}%` }}>
      {children}
    </div>
  );
}

function Tag({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.2)] ${
        dark ? "bg-[#14142B] text-white" : "bg-white text-[#14142B]"
      }`}
    >
      {children}
    </span>
  );
}

function Bubble({ ring = false, children }: { ring?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex size-14 items-center justify-center rounded-full bg-white/[0.16] ${ring ? "ring-2 ring-[#A99CFF]" : ""}`}
    >
      {children}
    </span>
  );
}

function Row({ icon, tint, title, text }: { icon: ReactNode; tint: string; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-white/70">{text}</span>
      </span>
    </div>
  );
}
