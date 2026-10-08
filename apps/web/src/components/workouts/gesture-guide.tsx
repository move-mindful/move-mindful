"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import type { TutorialMode } from "@move-mindful/core";
import guideBackground from "./guide-background.webp";
import {
  ArrowDown,
  ArrowUp,
  Bluetooth,
  ChevronLeft,
  Close,
  ChevronRight,
  Headphones,
  Loop,
  Music,
  Muted,
  Pause,
  Play,
  Settings,
  Timer,
  WatchTutorial,
} from "./icons";
import { TAP_ZONES, TUTORIAL_CONTROLS } from "./player-screens";

/**
 * The first-run guide to the player, over the stage on phones: tapping (the
 * three zones drawn over the video), swiping, the audio button and its card,
 * and wireless headphones. With TUTORIAL_CONTROLS on, also watching a
 * tutorial from the pause screen, Settings and the tutorial mode,
 * auto-advance, and last how the member's tutorials and auto-advance are set
 * right now, with a way into Settings. Shown once — right after Begin, over the warm-up, or as the first
 * exercise comes up when there's no warm-up (see `begin` in the core reducer)
 * — and again from Settings; signed-out /demo1 visitors get it every time.
 * The workout waits while it's open.
 */

/** One page of a guide: a picture, a title and a few rows (shared with the desktop guide). */
export interface Page {
  title: string;
  /** What goes above the panel. */
  picture: ReactNode;
  rows: Array<{ icon: ReactNode; tint?: string; title: string; text: string }>;
  /** About the tutorial controls or Settings: hidden with them (TUTORIAL_CONTROLS). */
  tutorials?: true;
}

const PAGES: Page[] = [
  {
    title: "Tap to control your workout",
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
    title: "Swipe to see more",
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
    title: "View tutorial",
    tutorials: true,
    picture: <PausedPicture />,
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
    title: "Adjust audio",
    picture: <AudioPicture />,
    rows: [
      {
        icon: <Music size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: "Music",
        text: "The music button turns it on or off: bottom left, or top left when paused.",
      },
      { icon: <Settings size={18} />, title: "Everything else", text: "In Settings: instructor audio, voice, sound effects." },
      { icon: <Muted size={18} />, title: "Mute all", text: "In Settings too: all sound off at once." },
    ],
  },
  {
    title: "Have Bluetooth headphones?",
    picture: <EarbudsPicture />,
    rows: [
      {
        icon: <Bluetooth size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: "Use them",
        text: "Connect them to your phone before you start.",
      },
      { icon: <Headphones size={18} />, title: "Hear it all", text: "Instructor, tips and music, in your ears." },
    ],
  },
  {
    title: "Adjust settings",
    tutorials: true,
    picture: (
      <>
        {/* The gear exactly where it sits on the pause screen: top right,
            under the progress bar (see PausedScreen). */}
        <span className="absolute right-4 top-[calc(max(20px,env(safe-area-inset-top))+18px)] flex size-[52px] items-center justify-center rounded-full bg-white/[0.14] ring-2 ring-[#A99CFF]">
          <Settings />
        </span>
        {/* The tutorial modes, in the middle. */}
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
      </>
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
    tutorials: true,
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
        text: "In Settings, or tap AUTO on the pause screen.",
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

/** What each tutorial mode does, for the last page. */
// Worded for fingers and mice alike: the desktop guide shares this page.
const MODE_TEXT: Record<TutorialMode, { label: string; text: string }> = {
  loop: { label: "Loop", text: "Each new exercise's tutorial plays on repeat until you start the exercise." },
  once: { label: "Play once", text: "Each new exercise's tutorial plays once, then the exercise starts." },
  off: { label: "Off", text: "Exercises start straight away. Watch a tutorial any time from the pause screen." },
};

/**
 * The last page: how tutorials and auto-advance are set right now — the
 * defaults, for someone new — in plain words, with a way into Settings.
 */
export function settingsPage({ mode, autoAdvance }: { mode: TutorialMode; autoAdvance: boolean }): Page {
  return {
    title: "Your settings",
    picture: <SettingsPicture mode={mode} autoAdvance={autoAdvance} />,
    rows: [
      {
        icon: <WatchTutorial size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: `Tutorials: ${MODE_TEXT[mode].label}`,
        text: MODE_TEXT[mode].text,
      },
      {
        icon: <Timer size={18} />,
        tint: "bg-[#A99CFF]/25 text-[#C9C0FF]",
        title: `Auto-advance: ${autoAdvance ? "On" : "Off"}`,
        text: autoAdvance
          ? "Rep sets move on by themselves after the time the reps usually take."
          : "Rep sets wait for you to move on. Timed sets and rests move on by themselves.",
      },
    ],
  };
}

export function GestureGuide({
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
  // With the tutorial controls, the last page is Your settings, after PAGES.
  const pages = TUTORIAL_CONTROLS ? [...PAGES, settingsPage(settings)] : PAGES.filter((p) => !p.tutorials);
  const [page, setPage] = useState(startOnSettings ? pages.length - 1 : 0);
  const current = pages[page];
  const last = page === pages.length - 1;

  return (
    <div className="absolute inset-0 z-30 flex flex-col" role="dialog" aria-modal="true" aria-label="How to use the player">
      {/* The backdrop runs the full height, behind the panel's rounded corners
          too; the pictures sit in the space above the panel, where they show.
          Every page sits on the same blurred studio photo, so nothing on the
          screen behind shows through: darker on page 1, under the tinted tap
          zones, and lighter after, so more of the room shows. */}
      <PhotoBackdrop soft={page > 0} />
      {page === 0 && <TapZonesBackdrop />}

      <div className="relative flex flex-1 items-center justify-center" aria-hidden="true">
        {current.picture}
      </div>

      <section className="relative flex flex-col gap-4 rounded-t-[28px] bg-[#1A1A34] px-5 pb-[max(28px,calc(env(safe-area-inset-bottom)+12px))] pt-6">
        {/* ✕ closes the guide from any page — in the panel's corner, clear of
            the pictures above (the Adjust settings page's gear sits in the screen's corner). */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">
              How it works · {page + 1} of {pages.length}
            </span>
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{current.title}</h2>
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close the guide"
            className="-mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-white/85"
          >
            <Close size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          {current.rows.map((r) => (
            <Row key={`${r.title}-${r.text}`} icon={r.icon} tint={r.tint ?? "bg-white/[0.14]"} title={r.title} text={r.text} />
          ))}
        </div>
        {last && TUTORIAL_CONTROLS && (
          <button
            type="button"
            onClick={onSettings}
            className="mt-1 flex h-[54px] items-center justify-center gap-2 rounded-full bg-white/[0.12] text-base font-semibold"
          >
            <Settings size={18} />
            Change settings
          </button>
        )}
        <div className={`flex items-center gap-3 ${last && TUTORIAL_CONTROLS ? "" : "mt-1"}`}>
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
            {last ? "Let's go!" : "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}

/** A mini pause screen, with Watch the tutorial picked out (shared with the desktop guide). */
export function PausedPicture() {
  return (
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
  );
}

/** The last page's picture: a mini Settings panel showing the current choices. */
function SettingsPicture({ mode, autoAdvance }: { mode: TutorialMode; autoAdvance: boolean }) {
  return (
    <div className="flex w-[270px] flex-col gap-3 rounded-[20px] bg-[#1A1A34]/85 p-4 ring-1 ring-white/10">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">Tutorials</span>
      <div className="flex gap-2">
        {(["loop", "once", "off"] as const).map((m) => (
          <span
            key={m}
            className={`rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold ${
              m === mode ? "border-[#A99CFF]/85 bg-[#A99CFF]/[0.14]" : "border-white/[0.18] bg-white/[0.05] text-white/70"
            }`}
          >
            {MODE_TEXT[m].label}
          </span>
        ))}
      </div>
      <span className="mt-1 flex items-center justify-between text-[15px] font-semibold">
        Auto-advance
        <MiniSwitch on={autoAdvance} />
      </span>
    </div>
  );
}

/**
 * The audio page's picture: the Audio card in miniature (as it starts out),
 * over the bottom row of controls with its speaker button picked out — on a
 * real set that row sits under this panel, so it's drawn here instead.
 */
function AudioPicture() {
  return (
    <div className="flex w-[270px] flex-col gap-4">
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-[#1A1A34]/85 p-4 ring-1 ring-white/10">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">Audio</span>
        {["Music", "Instructor audio", "Sound effects"].map((label) => (
          <span key={label} className="flex items-center justify-between text-[15px] font-semibold">
            {label}
            <MiniSwitch on />
          </span>
        ))}
        <span className="mt-1 flex items-center justify-between border-t border-white/10 pt-3 text-[15px] font-semibold">
          Mute all
          <MiniSwitch on={false} />
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.14] ring-2 ring-[#A99CFF]">
          <Music size={20} />
        </span>
        <span className="h-11 flex-1 rounded-full border border-white/15 bg-white/[0.06]" />
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/50">
          <Pause size={18} />
        </span>
      </div>
    </div>
  );
}

/**
 * The headphones page's picture: a pair of wireless earbuds — generic, not
 * any brand's — with a signal arcing above them, on a soft accent glow.
 */
function EarbudsPicture() {
  return (
    <svg width="288" height="240" viewBox="0 0 240 200" aria-hidden="true">
      <defs>
        <linearGradient id="guide-buds-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F1F1F6" />
          <stop offset="1" stopColor="#C9C9D8" />
        </linearGradient>
        <linearGradient id="guide-buds-stem" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D4D4E0" />
        </linearGradient>
        <radialGradient id="guide-buds-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#A99CFF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#A99CFF" stopOpacity="0" />
        </radialGradient>
        <filter id="guide-buds-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      <ellipse cx="120" cy="100" rx="110" ry="90" fill="url(#guide-buds-glow)" />
      <g fill="none" stroke="#C9C0FF" strokeWidth="3" strokeLinecap="round">
        <path d="M104 52a24 24 0 0 1 32 0" />
        <path d="M94 40a38 38 0 0 1 52 0" opacity="0.6" />
      </g>
      <Earbud x={78} turn={18} />
      <Earbud x={162} turn={-18} mirrored />
    </svg>
  );
}

/** One earbud: a rounded head with its ear tip and speaker, and a stem. */
function Earbud({ x, turn, mirrored = false }: { x: number; turn: number; mirrored?: boolean }) {
  return (
    <g transform={`translate(${x} 92) rotate(${turn})${mirrored ? " scale(-1 1)" : ""}`} filter="url(#guide-buds-shadow)">
      <rect x="-8" y="2" width="16" height="78" rx="8" fill="url(#guide-buds-stem)" />
      <rect x="-8" y="70" width="16" height="10" rx="5" fill="#B4B4C6" />
      <ellipse cx="-2" cy="-4" rx="24" ry="21" fill="url(#guide-buds-shell)" />
      <ellipse cx="13" cy="-9" rx="11" ry="10" fill="#E4E4EC" />
      <ellipse cx="14" cy="-9" rx="5" ry="4.5" fill="#3A3A52" opacity="0.8" />
      <ellipse cx="-12" cy="6" rx="3.2" ry="2.2" fill="#3A3A52" opacity="0.35" />
    </g>
  );
}

/** A small switch for the guide's pictures. */
function MiniSwitch({ on }: { on: boolean }) {
  return (
    <span className={`relative h-[26px] w-[44px] shrink-0 rounded-full ${on ? "bg-[#A99CFF]" : "bg-white/25"}`}>
      <span className={`absolute top-0.5 size-[22px] rounded-full bg-white ${on ? "right-0.5" : "left-0.5"}`} />
    </span>
  );
}

/**
 * A studio photo, darkened and blurred — the guide's background. `soft`
 * (every page after the first) blurs and darkens it less.
 */
function PhotoBackdrop({ soft }: { soft: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#14142B]" aria-hidden="true">
      <Image
        src={guideBackground}
        alt=""
        fill
        sizes="100vw"
        className={`scale-110 object-cover transition-[filter] duration-300 ${
          soft ? "blur-[6px] brightness-[0.62]" : "blur-lg brightness-[0.45]"
        }`}
      />
      <div
        className={`absolute inset-0 bg-[#14142B] transition-opacity duration-300 ${soft ? "opacity-20" : "opacity-35"}`}
      />
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

function Bubble({ children }: { children: ReactNode }) {
  return <span className="flex size-14 items-center justify-center rounded-full bg-white/[0.16]">{children}</span>;
}

export function Row({ icon, tint, title, text }: { icon: ReactNode; tint: string; title: string; text: string }) {
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
