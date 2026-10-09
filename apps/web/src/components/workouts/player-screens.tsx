"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import type { TutorialMode, WorkoutStep } from "@move-mindful/core";
import { clock, type PlayerWorkout } from "@/lib/workouts/player";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Star,
  ChevronUp,
  Close,
  Dumbbell,
  Exit,
  Loop,
  Pause,
  Play,
  RestartSet,
  RestartWorkout,
  Settings,
  Music,
  MusicOff,
  WatchTutorial,
} from "./icons";
import { UP_NEXT } from "./cue-audio";
import { FirstWorkoutBadge } from "./first-workout-badge";
import { Marquee } from "./marquee";
import { NextCard } from "./up-next-card";
import { WorkoutRows } from "./workout-rows";

// The player's screens, drawn from the player design canvas (mobile frames).
// Each fills the 9:16 stage the videos play in; none of them knows about the
// state machine — workout-player.tsx works out what to show and passes it in.

/**
 * The tutorial controls — Watch the tutorial on the pause screen, the
 * Tutorials section in Settings, and the guides' pages on tutorials and
 * settings (View tutorial, Adjust settings, Auto-advance, Your settings) —
 * hidden for now (Oct 2026). Meanwhile everyone gets the default tutorial
 * mode, Off (the player ignores saved ones, and keeps them). `true` brings
 * them back.
 */
export const TUTORIAL_CONTROLS = false;

const round52 =
  "flex size-[52px] shrink-0 items-center justify-center rounded-full bg-white/[0.14] backdrop-blur-md transition active:scale-95";
const bottomPad = "pb-[max(28px,calc(env(safe-area-inset-bottom)+12px))]";

// ── Shared pieces ─────────────────────────────────────

/** The top of the stage: the progress bar sits here. */
export function TopBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 px-4 pt-[max(20px,env(safe-area-inset-top))]">
      {children}
    </div>
  );
}

/**
 * Darken the top of the video just enough for the progress bar (and, on the
 * warm-up, the times under it) to read. The bottom controls carry their own
 * shade — see BottomShade.
 */
export function TopShade({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 ${
        tall ? "h-[calc(max(20px,env(safe-area-inset-top))+66px)]" : "h-[calc(max(20px,env(safe-area-inset-top))+40px)]"
      }`}
      style={{ background: "linear-gradient(180deg, rgba(14,14,32,0.58) 0%, rgba(14,14,32,0.3) 55%, rgba(14,14,32,0) 100%)" }}
    />
  );
}

/**
 * The shade behind a stack of bottom controls: it sits inside the stack, so it
 * grows and shrinks with it (extra lines, controls swiped away) and always
 * reaches just a little above the top element. The stack needs `isolate`.
 *
 * Its stops are fixed distances down from its top edge, not percentages, so a
 * short stack (controls swiped away) shows only the gentle top of the same
 * fade instead of squeezing the whole fade into less space.
 */
function BottomShade() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-12 bottom-0 -z-10"
      style={{
        background:
          "linear-gradient(180deg, rgba(14,14,32,0) 0px, rgba(14,14,32,0.3) 56px, rgba(14,14,32,0.66) 128px, rgba(14,14,32,0.8) 256px)",
      }}
    />
  );
}

/**
 * Shown over the video while the clip on screen is still loading. It only
 * fades in after a third of a second, so a quick load doesn't flash it, and
 * goes the moment the video plays.
 */
export function LoadingSpinner({ show }: { show: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
        show ? "opacity-100 delay-300" : "opacity-0 delay-0"
      }`}
    >
      {show && (
        <>
          <span className="flex size-16 items-center justify-center rounded-full bg-[#0E0E20]/45 backdrop-blur-sm">
            <span className="size-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
          </span>
          <span className="sr-only">Loading</span>
        </>
      )}
    </div>
  );
}

/** The dim layer behind rests, pause and the summary. */
export function Dim({ strength = 0.66 }: { strength?: number }) {
  return <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(10,10,26,${strength})` }} />;
}

/**
 * The rest's dim, kept on the stage through the exercises: it carries on
 * from a rest into the exercise after it — under its name (BeginCard) — or
 * fades in when an exercise follows another. It goes at once, with the name,
 * as the set's controls come back (Oct 2026: fading out, it left them showing
 * over a still-dark video for a moment).
 */
export function StepDim({ on }: { on: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 transition-opacity ${on ? "opacity-100 duration-300" : "opacity-0 duration-0"}`}
      style={{ background: "rgba(10,10,26,0.4)" }}
    />
  );
}

/**
 * As an exercise begins: its name, with the reps (or time) and side under
 * it, big in the middle of the screen over the dim while its voice
 * announcement is said — then gone at once, with the dim. The reps are set
 * as on the set screen: the number big, "reps" smaller on its baseline (a
 * time all big), the side pill centred on "reps". Stays mounted through the
 * set.
 */
export function BeginCard({
  show,
  name,
  metric,
  side,
  theater = false,
}: {
  show: boolean;
  name: string;
  /** Reps to do, or the set's time. */
  metric: { kind: "reps"; amount: number } | { kind: "time"; seconds: number };
  side: "right" | "left" | null;
  theater?: boolean;
}) {
  const number = `font-semibold leading-none tracking-[-0.03em] tabular-nums ${theater ? "text-[72px]" : "text-[56px]"}`;
  const word = `font-medium ${theater ? "text-[32px]" : "text-[26px]"}`;
  return (
    <div
      aria-hidden={!show || undefined}
      className={`pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 px-8 text-center transition-[opacity,scale] ${
        show ? "scale-100 opacity-100 duration-300 starting:scale-95 starting:opacity-0" : "opacity-0 duration-0"
      }`}
      style={{ textShadow: "0 2px 18px rgba(10,10,26,0.55)" }}
    >
      <h2 className={`text-balance font-semibold leading-[1.1] tracking-[-0.02em] ${theater ? "text-[46px]" : "text-[36px]"}`}>
        {name}
      </h2>
      <div className="flex items-baseline gap-3">
        {metric.kind === "reps" ? (
          <span className={`flex items-baseline ${theater ? "gap-2" : "gap-1.5"}`}>
            <span className={number}>{metric.amount}</span>
            <span className={word}>{metric.amount === 1 ? "rep" : "reps"}</span>
          </span>
        ) : (
          <span className={number}>{clock(metric.seconds)}</span>
        )}
        {side && (
          <span className={word}>
            <span className="inline-flex h-7 items-center rounded-full bg-[#A99CFF] px-3 align-middle text-[13px] font-bold tracking-[0.08em] [text-shadow:none]">
              {side.toUpperCase()}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Out of sight while an exercise's name is up (BeginCard) — the progress bar
 * and the set's info and controls — so there's just the video under the dim
 * and the name in the middle; back the moment the dim goes (no fade: their
 * frosted fills would show over a dim still fading). It covers the whole
 * stage (like Dimmed), so what's inside keeps its place; out of reach while
 * hidden.
 */
export function BeginClear({ clear, children }: { clear: boolean; children: ReactNode }) {
  return (
    <div inert={clear} className={`pointer-events-none absolute inset-0 ${clear ? "opacity-0" : ""}`}>
      {children}
    </div>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={round52}>
      {children}
    </button>
  );
}

function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <RoundButton label="Settings" onClick={onClick}>
      <Settings />
    </RoundButton>
  );
}

/**
 * Settings, top right under the progress bar: on the pause screens, and on
 * phones on a rest or get-ready screen while its countdown is held.
 */
export function CornerSettings({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute right-4 top-[calc(max(20px,env(safe-area-inset-top))+18px)] z-10">
      <SettingsButton onClick={onClick} />
    </div>
  );
}

/**
 * The music button: the notes while the music's playing, struck through while
 * it's off — a tap turns it off or on (all it does, for now; the rest of the
 * sound is at the top of Settings).
 */
function MusicButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Music"
      aria-pressed={on}
      title={on ? "Turn the music off" : "Turn the music on"}
      onClick={onClick}
      className={round52}
    >
      {on ? <Music /> : <MusicOff />}
    </button>
  );
}

/** The music button, top left — Settings' partner on the phone's pause screens (see CornerSettings). */
export function CornerMusic({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div className="absolute left-4 top-[calc(max(20px,env(safe-area-inset-top))+18px)] z-10">
      <MusicButton on={on} onClick={onClick} />
    </div>
  );
}

/**
 * Audio · Up next (opens the overview) · Pause. Up next fills the space
 * between the two buttons, so it keeps one width whatever it names, as the
 * Up next cards do; a long name is cut short.
 */
function ControlsRow({
  pill,
  fill = null,
  musicOn,
  onPause,
  onOverview,
  onMusic,
  still = false,
}: {
  pill: { label: string; text: string };
  /** How far until the set moves on by itself (auto-advance, a timed set): Up next fills with it. */
  fill?: number | null;
  /** The music's playing (the music button shows it). */
  musicOn: boolean;
  onPause: () => void;
  onOverview: () => void;
  /** The music button: music off or on. */
  onMusic: () => void;
  /** Swiped away: a text too long for the pill holds at its first word, to start over as it comes back. */
  still?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <MusicButton on={musicOn} onClick={onMusic} />
      <button
        type="button"
        aria-label={`Open workout overview. ${pill.label}: ${pill.text}`}
        onClick={onOverview}
        className="relative flex h-[52px] min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-full border border-white/20 bg-white/10 pl-3.5 pr-5 text-left backdrop-blur-md"
      >
        {fill !== null && <ProgressFill fraction={fill} />}
        <span className="relative">
          <ChevronUp />
        </span>
        <span className="relative flex min-w-0 flex-col gap-px">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{pill.label}</span>
          {/* Too long for the pill, it scrolls (see Marquee). */}
          <Marquee text={pill.text} still={still} className="text-[15px] font-medium" />
        </span>
      </button>
      <RoundButton label="Pause" onClick={onPause}>
        <Pause />
      </RoundButton>
    </div>
  );
}

export function Chip({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full font-medium ${
        large ? "h-8 bg-white/[0.12] px-3.5 text-[15px]" : "h-[30px] bg-white/[0.14] px-3 text-sm"
      }`}
    >
      {children}
    </span>
  );
}

// ── Tap zones ─────────────────────────────────────────

/**
 * The overview being pulled up by the finger: the tap zones report the drag
 * (via the player) and the overview drawer, which is always mounted, follows
 * it. Nothing in React changes until the finger lifts.
 */
export function createSheetPull() {
  type Follower = { move: (distance: number) => void; end: (distance: number, velocity: number) => void };
  let active = false;
  let follower: Follower | null = null;
  return {
    get active() {
      return active;
    },
    start() {
      active = true;
    },
    move(distance: number) {
      follower?.move(distance);
    },
    end(distance: number, velocity: number) {
      active = false;
      follower?.end(distance, velocity);
    },
    /** For the drawer: follow pulls from now on. Returns a detach function. */
    attach(f: Follower) {
      follower = f;
      return () => {
        if (follower === f) follower = null;
      };
    },
  };
}

export type SheetPull = ReturnType<typeof createSheetPull>;

/**
 * How the video splits into tap zones, left to right, as fractions of its
 * width: back, pause, next. Pause gets the wide middle so it's hard to miss.
 * The gesture guide draws its zones from these too.
 */
export const TAP_ZONES = { back: 0.28, pause: 0.44, next: 0.28 } as const;

/**
 * Gestures over the video, in three zones (TAP_ZONES): tap the left to go
 * back, the wide middle to pause, the right to move on. Press and hold anywhere also
 * pauses. Swipe down hides the controls; swipe up shows them again — or, with
 * `pullUp`, drags the overview up under the finger. Buttons sit above this
 * layer, so they never count as a tap here.
 */
export function TapZones({
  onBack,
  onNext,
  onMiddle,
  onHold,
  onSwipeUp,
  onSwipeDown,
  pullUp,
  onPullMove,
  onPullEnd,
  nextLabel = "Next",
  backLabel = "Previous set",
}: {
  /** Left and right taps; left out, those sides do nothing. */
  onBack?: () => void;
  onNext?: () => void;
  onMiddle: () => void;
  onHold: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  /** Dragging up pulls the overview (instead of a swipe up calling `onSwipeUp`). */
  pullUp?: boolean;
  onPullMove?: (distance: number) => void;
  /** `velocity` is upward, in px per ms. */
  onPullEnd?: (distance: number, velocity: number) => void;
  nextLabel?: string;
  backLabel?: string;
}) {
  const press = useRef<{
    x: number;
    y: number;
    zone: 0 | 1 | 2;
    done: boolean;
    pulling: boolean;
    last: { y: number; t: number };
    velocity: number;
    timer: number;
  } | null>(null);
  useEffect(() => () => window.clearTimeout(press.current?.timer), []);

  const end = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 touch-none select-none [-webkit-touch-callout:none]"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          end();
          // Keep getting this finger's moves even once something (the
          // overview's backdrop) appears under it.
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const box = e.currentTarget.getBoundingClientRect();
          const across = (e.clientX - box.left) / box.width;
          const p = {
            x: e.clientX,
            y: e.clientY,
            zone: (across < TAP_ZONES.back ? 0 : across < 1 - TAP_ZONES.next ? 1 : 2) as 0 | 1 | 2,
            done: false,
            pulling: false,
            last: { y: e.clientY, t: e.timeStamp },
            velocity: 0,
            timer: 0,
          };
          p.timer = window.setTimeout(() => {
            p.done = true;
            onHold();
          }, 450);
          press.current = p;
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p) return;
          const dx = e.clientX - p.x;
          const dy = e.clientY - p.y;
          const dt = e.timeStamp - p.last.t;
          if (dt > 0) p.velocity = (p.last.y - e.clientY) / dt;
          p.last = { y: e.clientY, t: e.timeStamp };
          if (p.pulling) {
            onPullMove?.(Math.max(0, -dy));
            return;
          }
          if (p.done) return;
          if (pullUp && dy < -10 && Math.abs(dy) > Math.abs(dx)) {
            p.pulling = true;
            window.clearTimeout(p.timer);
            onPullMove?.(-dy);
          } else if (Math.abs(dy) > 60 && Math.abs(dx) < 80) {
            p.done = true;
            window.clearTimeout(p.timer);
            if (dy < 0) onSwipeUp?.();
            else onSwipeDown?.();
          } else if (Math.hypot(dx, dy) > 16) {
            window.clearTimeout(p.timer);
          }
        }}
        onPointerUp={(e) => {
          const p = press.current;
          end();
          if (!p) return;
          if (p.pulling) {
            onPullEnd?.(Math.max(0, p.y - e.clientY), p.velocity);
            return;
          }
          if (p.done || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 24) return;
          [onBack, onMiddle, onNext][p.zone]?.();
        }}
        onPointerCancel={() => {
          const p = press.current;
          end();
          if (p?.pulling) onPullEnd?.(0, 0);
        }}
      />
      {/* Back and next for keyboards and screen readers (Pause is a real button). */}
      {onBack && (
        <button type="button" className="sr-only" onClick={onBack}>
          {backLabel}
        </button>
      )}
      {onNext && (
        <button type="button" className="sr-only" onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </>
  );
}

/**
 * Folds its content away (height and opacity together) when the member hides
 * the controls with a swipe down. `inert` takes the hidden buttons out of the
 * tab order and away from screen readers too.
 */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * A minimised view's one line: a label pill ("Up next", "Tutorial") and what
 * it names, scrolling when it doesn't fit (Marquee).
 */
/** A bold capitals pill ("Up next", "Tutorial") and a line of text beside it — phones' minimised views and desktop's info. */
export function LabelLine({
  label,
  text,
  fill = null,
  strong = false,
  still = false,
  className = "",
}: {
  label: string;
  text: string;
  /** Collapsed out of sight: a text too long for the line holds at its first word, to start over as it shows. */
  still?: boolean;
  /** Fill the label pill with a countdown's progress (Up next, moving on by itself). */
  fill?: number | null;
  /** The text a size up and bolder — the exercise's name on the minimised tutorial. */
  strong?: boolean;
  className?: string;
}) {
  return (
    <p className={`flex min-w-0 items-center gap-2 ${className}`}>
      {/* As tall as the chips below it, a shade brighter and in bold capitals. */}
      <span className="relative flex h-[30px] shrink-0 items-center overflow-hidden rounded-full bg-white/[0.24] px-3 text-[13px] font-bold uppercase tracking-[0.08em]">
        {fill !== null && <ProgressFill fraction={fill} />}
        <span className="relative">{label}</span>
      </span>
      <Marquee text={text} still={still} className={`min-w-0 ${strong ? "text-[17px] font-semibold" : "text-[15px] font-medium"}`} />
    </p>
  );
}

// ── The exercise ──────────────────────────────────────

export function SetScreen({
  name,
  metric,
  side,
  groupLine,
  pill,
  fill = null,
  hidden,
  onPause,
  onOverview,
  musicOn,
  onMusic,
  tip = null,
  upNext = null,
}: {
  name: string;
  /** Reps to do, or the seconds left on a timed set. */
  metric: { kind: "reps"; amount: number } | { kind: "time"; seconds: number };
  side: "right" | "left" | null;
  /** "Superset 1 · Round 2 of 3" inside a group. */
  groupLine: string | null;
  pill: { label: string; text: string };
  /** How far until the set moves on by itself, if it will — see ControlsRow. */
  fill?: number | null;
  /** Controls swiped away: just the reps (or time) left over the video. */
  hidden: boolean;
  onPause: () => void;
  onOverview: () => void;
  /** The music's playing (the music button shows it). */
  musicOn: boolean;
  /** The music button: music off or on. */
  onMusic: () => void;
  /** The instructor's audio tip (CoachTip): at the right end of the reps, over the Pause button. */
  tip?: ReactNode;
  /** The Up next card (UpNextCard) near the set's end: 16px above whatever tops the info (the superset line, or the reps). */
  upNext?: ReactNode;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 isolate flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
      <BottomShade />
      {/* Just above the stack, 16px clear of whatever's at its top — the
          superset line, or the reps — within the screen's 20px gutters. */}
      {upNext && <div className="absolute inset-x-5 bottom-full mb-4 flex justify-center">{upNext}</div>}
      {groupLine && (
        <Collapse open={!hidden}>
          <div className="mb-2 flex items-center gap-[7px] text-[13px] font-semibold tracking-[0.02em] text-[#A99CFF]">
            <Loop size={14} />
            {groupLine}
          </div>
        </Collapse>
      )}
      {/* On the reps' baseline; the side pill is centred on "reps" (see below). */}
      <div className="relative flex items-baseline gap-3">
        {/* A bubble's height above the reps (its bottom where its top would be
            sitting on them), over the video; 13px in from the video's edge, so
            about over the Pause button (desktop has more room still). */}
        {tip && <div className="absolute bottom-0 right-[-7px] -translate-y-full">{tip}</div>}
        {metric.kind === "reps" ? (
          <span className="flex items-baseline gap-1.5">
            <span className="text-[56px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{metric.amount}</span>
            <span className="text-[26px] font-medium">{metric.amount === 1 ? "rep" : "reps"}</span>
          </span>
        ) : (
          <span role="timer" className="text-[56px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {clock(metric.seconds)}
          </span>
        )}
        {/* Centred on the lowercase "reps": CSS's own middle (half an x-height up
            from the baseline), in a box set in the "reps" type — and so at the
            same height beside a time. */}
        {side && (
          <span className="text-[26px] font-medium">
            <span className="inline-flex h-7 items-center rounded-full bg-[#A99CFF] px-3 align-middle text-[13px] font-bold tracking-[0.08em] text-white">
              {side.toUpperCase()}
            </span>
          </span>
        )}
      </div>
      {/* Controls swiped away: what's next, under the reps. */}
      <Collapse open={hidden}>
        <LabelLine label={pill.label} text={pill.text} fill={fill} still={!hidden} className="mt-2" />
      </Collapse>
      <Collapse open={!hidden}>
        <h1 className="mt-1 truncate text-xl font-semibold leading-tight">{name}</h1>
        <div className="mt-[18px]">
          <ControlsRow
            pill={pill}
            fill={fill}
            musicOn={musicOn}
            onPause={onPause}
            onOverview={onOverview}
            onMusic={onMusic}
            still={hidden}
          />
        </div>
      </Collapse>
    </div>
  );
}

export function TutorialScreen({
  name,
  chips,
  levels,
  progress,
  hidden,
  onBegin,
  onPause,
  musicOn,
  onMusic,
}: {
  name: string;
  chips: string[];
  levels: string | null;
  /** How far through the tutorial is, and the seconds left of it. */
  progress: TutorialProgress;
  /** Controls swiped away: just the sets and reps left over the video. */
  hidden: boolean;
  onBegin: () => void;
  onPause: () => void;
  /** The music's playing (the music button shows it). */
  musicOn: boolean;
  /** The music button: music off or on. */
  onMusic: () => void;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 isolate flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
      <BottomShade />
      <Collapse open={!hidden}>
        {/* The one title that may wrap: up to two lines, then an ellipsis. */}
        <h1 className="mb-3 line-clamp-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]">
          {name}
        </h1>
      </Collapse>
      {/* Minimised: "Tutorial:" and the exercise above the pills, and a small
          Skip at the end of their row. */}
      <Collapse open={hidden}>
        <LabelLine label="Tutorial" text={name} strong still={!hidden} className="mb-2.5" />
      </Collapse>
      <div className={`flex gap-2 ${hidden ? "flex-nowrap items-center" : "flex-wrap"}`}>
        {chips.map((c) => (
          <span key={c} className="shrink-0">
            <Chip>{c}</Chip>
          </span>
        ))}
        {levels && (
          <span className="shrink-0">
            <Chip>
              <Dumbbell size={16} />
              {levels}
            </Chip>
          </span>
        )}
        {hidden && (
          <span className="ml-auto shrink-0">
            <MiniSkipButton progress={progress} onBegin={onBegin} />
          </span>
        )}
      </div>
      <Collapse open={!hidden}>
        {/* Audio · Skip tutorial (filling as it plays) · Pause — Skip takes the
            workout pill's place; the overview is a swipe up away. */}
        <div className="mt-[18px] flex items-center gap-3">
          <MusicButton on={musicOn} onClick={onMusic} />
          <BeginButton progress={progress} onBegin={onBegin} compact className="min-w-0 flex-1" />
          <RoundButton label="Pause" onClick={onPause}>
            <Pause />
          </RoundButton>
        </div>
      </Collapse>
    </div>
  );
}

/**
 * The band behind a Skip button that fills as its clip plays — Skip tutorial
 * and Skip warm-up, full size and minimised. `restartKey` restarts the fill
 * (rather than sliding it back) when a looping clip goes round again.
 */
export function ProgressFill({ fraction, restartKey = 0 }: { fraction: number; restartKey?: number }) {
  return (
    <span
      key={restartKey}
      aria-hidden="true"
      className="absolute inset-y-0 left-0 bg-white/20"
      style={{ width: `${Math.min(100, Math.max(0, fraction * 100))}%`, transition: "width 250ms linear" }}
    />
  );
}

export interface TutorialProgress {
  fraction: number;
  secondsLeft: number;
  /** Trips round a looping tutorial — the fill restarts (rather than sliding back) when it changes. */
  cycle: number;
  /** Loops until tapped, rather than starting the exercise at the end. */
  loops: boolean;
}

/**
 * Starts the exercise from its tutorial: "Skip tutorial", filling up as the
 * tutorial plays with the time left of it on the right. A tutorial playing once
 * starts the exercise when that runs out; a looping one starts over. `compact`
 * is the phone's, between the sound and pause buttons: their height, with the
 * label to the left of the time rather than centred over it.
 */
export function BeginButton({
  progress,
  onBegin,
  className = "",
  compact = false,
}: {
  progress: TutorialProgress;
  onBegin: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onBegin}
      aria-label={
        progress.loops
          ? "Skip tutorial and start the exercise"
          : `Skip tutorial. The exercise starts on its own in ${Math.ceil(progress.secondsLeft)} seconds`
      }
      className={`relative flex items-center overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] font-semibold ${
        compact ? "h-[52px] justify-between gap-2 px-4 text-base" : "h-[58px] justify-center gap-2.5 text-[17px]"
      } ${className}`}
    >
      <ProgressFill fraction={progress.fraction} restartKey={progress.cycle} />
      {compact ? (
        <>
          <span className="relative flex min-w-0 items-center gap-1.5">
            <span className="truncate">Skip tutorial</span>
            <ArrowRight size={18} />
          </span>
          <span className="relative shrink-0 text-[15px] font-medium tabular-nums text-white/80">
            {clock(Math.ceil(progress.secondsLeft))}
          </span>
        </>
      ) : (
        <>
          <span className="relative">Skip tutorial</span>
          <span className="relative">
            <ArrowRight />
          </span>
          <span className="absolute inset-y-0 right-[22px] flex items-center text-[15px] font-medium tabular-nums text-white/80">
            {clock(Math.ceil(progress.secondsLeft))}
          </span>
        </>
      )}
    </button>
  );
}

/** Skip tutorial, pill-sized, for the tutorial's minimised row: fills as it plays. */
function MiniSkipButton({
  progress,
  onBegin,
  label = "Skip",
  aria = "Skip tutorial and start the exercise",
}: {
  progress: Pick<TutorialProgress, "fraction" | "cycle">;
  onBegin: () => void;
  label?: string;
  aria?: string;
}) {
  return (
    <button
      type="button"
      onClick={onBegin}
      aria-label={aria}
      className="relative flex h-[30px] shrink-0 items-center gap-1 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] pl-3 pr-2.5 text-sm font-semibold"
    >
      <ProgressFill fraction={progress.fraction} restartKey={progress.cycle} />
      <span className="relative">{label}</span>
      <span className="relative">
        <ArrowRight size={15} />
      </span>
    </button>
  );
}

// ── Rest, pause and the summary ───────────────────────
// On desktop ("theater") these centre everything in the video column instead
// of pinning the buttons to the bottom.

const centered = "absolute inset-0 flex flex-col items-center justify-center gap-9 overflow-y-auto py-[60px]";
const bottomGroup = (theater: boolean) =>
  theater ? "flex w-[380px] max-w-[calc(100%-40px)] flex-col" : `flex flex-col px-5 ${bottomPad}`;

/** The countdown ring round Get ready: 200px across, radius 92. */
const RING = 2 * Math.PI * 92;

/**
 * The buttons under a countdown (rest, get ready): Pause — which holds the
 * countdown right there and turns into Resume — beside the way on (Continue,
 * Start now).
 */
function CountdownControls({
  paused,
  onPause,
  onResume,
  goLabel,
  onGo,
  fill = null,
}: {
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  goLabel: string;
  onGo: () => void;
  /**
   * How far the screen has run toward moving on by itself. With it, the way on
   * is frosted like the Up next pill and fills as that does; without, it's
   * solid white.
   */
  fill?: number | null;
}) {
  return (
    <>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          className="flex h-[58px] flex-1 items-center justify-center gap-2.5 rounded-full bg-white/[0.14] text-[17px] font-semibold"
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={onGo}
          className={`relative flex h-[58px] flex-[1.4] items-center justify-center gap-2.5 overflow-hidden rounded-full text-[17px] font-semibold ${
            fill !== null ? "border border-white/20 bg-white/10 backdrop-blur-md" : "bg-white text-[#14142B]"
          }`}
        >
          {fill !== null && <ProgressFill fraction={fill} />}
          <span className="relative">{goLabel}</span>
          <span className="relative">
            <ArrowRight />
          </span>
        </button>
      </div>
    </>
  );
}


/**
 * GET READY over its countdown ring, in the accent at 32px. Held there
 * (Pause), a grey PAUSED (16px) sits just above it — floating, so pausing
 * doesn't move the ring.
 */
function CountdownTitle({ paused, children }: { paused: boolean; children: ReactNode }) {
  return (
    <div className="relative font-bold uppercase tracking-[0.16em]">
      {paused && (
        <span className="absolute bottom-full left-1/2 mb-[5px] -translate-x-1/2 whitespace-nowrap text-base text-white/75">
          Paused
        </span>
      )}
      <span className="block text-[32px] leading-none text-[#A99CFF]">{children}</span>
    </div>
  );
}

/**
 * A rest, laid out like the exercise screen: the next exercise's video plays
 * clear behind it, and at the bottom left the time left — always m:ss (1:00,
 * 0:45, 0:09), so it never changes width — with REST beside it where a set has
 * its reps, then the Up next card and Pause / Continue. Desktop shows the
 * same in the video column. Held (Pause), PAUSED floats above the time and
 * Pause reads Resume.
 *
 * Minimised (controls swiped down, phones): the time stays, and the card and
 * buttons fold into one line under it — Up next, filling as the rest runs,
 * and what it is, as on a set (a tap on the right moves on). Held, the full
 * controls come back (Resume is there), and it folds again as it carries on.
 */
export function RestScreen({
  secondsLeft,
  seconds,
  next,
  paused,
  hidden = false,
  onPause,
  onResume,
  onContinue,
  tip = null,
  theater = false,
}: {
  secondsLeft: number;
  /** The rest's whole length: minimised, Up next fills with how much of it has run. */
  seconds: number;
  /** `short`: the minimised line's — the name, and the reps or time ("Upright row · 12 reps"). */
  next: { label: string; name: string; detail: string; short: string; thumbnail: string | null } | null;
  /** Held right here (Pause), the countdown stopped — see CountdownControls. */
  paused: boolean;
  /** Controls swiped away: just the time, and the one line under it. */
  hidden?: boolean;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  /** The rest's audio tip (CoachTip), taking no room: a bubble's height above the time, at its right end, as on a set. */
  tip?: ReactNode;
  theater?: boolean;
}) {
  const shown = Math.ceil(secondsLeft);
  // With the Up next chime (UP_NEXT.before, 10 s out), REST slides up and away
  // and a purple GET READY slides up in its place. A rest that short from the
  // start just says GET READY.
  const ready = secondsLeft <= UP_NEXT.before;
  const mini = hidden && !paused;
  const label = "col-start-1 row-start-1 text-2xl font-bold uppercase leading-none tracking-[0.16em] transition-[opacity,translate] duration-300 ease-out";
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 isolate flex flex-col [&_button]:pointer-events-auto ${
        theater ? "px-7 pb-10" : `px-5 ${bottomPad}`
      }`}
    >
      <BottomShade />
      <div className="relative flex items-baseline gap-[11px]">
        {paused && (
          <span className="absolute bottom-full left-0 mb-2 text-base font-bold uppercase tracking-[0.16em] text-white/75">
            Paused
          </span>
        )}
        {tip && <div className="absolute bottom-0 right-[-7px] -translate-y-full">{tip}</div>}
        {/* Opened up a little (like the reps are not), so a pair like the 00 in 1:00 doesn't touch. */}
        <span
          role="timer"
          aria-label={`${shown} seconds of rest left`}
          className="text-[60px] font-semibold leading-none tracking-[0.03em] tabular-nums"
        >
          {clock(shown)}
        </span>
        {/* The two share one spot (a one-cell grid), so the swap moves nothing else. */}
        <span className="inline-grid">
          <span aria-hidden={ready || undefined} className={`${label} ${ready ? "-translate-y-3 opacity-0" : ""}`}>
            Rest
          </span>
          <span aria-hidden={!ready || undefined} className={`${label} text-[#A99CFF] ${ready ? "" : "translate-y-3 opacity-0"}`}>
            Get ready
          </span>
        </span>
      </div>
      {/* Minimised: what's next on one line, Up next filling as the rest runs (as on a set moving on by itself). */}
      <Collapse open={mini}>
        {next && (
          <LabelLine
            label="Up next"
            text={next.short}
            fill={seconds ? 1 - secondsLeft / seconds : 0}
            still={!mini}
            className="mt-2"
          />
        )}
      </Collapse>
      <Collapse open={!mini}>
        {next && (
          <NextCard
            label={next.label}
            name={next.name}
            detail={next.detail}
            thumbnail={next.thumbnail}
            large={theater}
            still={mini}
            className="mt-[18px] w-full"
          />
        )}
        <div className="mt-5">
          <CountdownControls paused={paused} onPause={onPause} onResume={onResume} goLabel="Continue" onGo={onContinue} />
        </div>
      </Collapse>
    </div>
  );
}

// ── The workout overview ──────────────────────────────

/** How long the overview's list takes to glide the lit exercise to its middle (ms). */
const RUNDOWN_SCROLL_MS = 800;

/**
 * The workout overview, after the intro (the "rundown"): the exercise list
 * over each exercise's loop in turn — the stage plays them, dimmed the whole
 * way across as on a rest — with the one on screen lit, and kept near the
 * list's middle, while the instructor's tip talks the workout through.
 * Pause holds it all; Continue, filling as the section runs, goes on to the
 * first exercise. Desktop shows the same in the video column. In the player
 * the screen takes taps as the others do (`onTap`): the middle pauses (or
 * resumes), the right moves on. The builder shows it too, recording the tip:
 * its own `controls`, and `onPick` to tap exercises as they're talked about.
 */
export function RundownScreen({
  workout,
  steps,
  minutes,
  exerciseId,
  onPick,
  fraction,
  paused,
  onPause,
  onResume,
  onContinue,
  tip = null,
  theater = false,
  controls,
  fit = false,
  listWarmup = false,
  onTap,
}: {
  workout: PlayerWorkout;
  steps: WorkoutStep[];
  /** The workout's estimated length, beside the title (as the preview shows it). */
  minutes: number;
  /** The exercise whose loop is on screen. */
  exerciseId: string | null;
  /** The builder's recorder: tapping an exercise picks it (with the tap's time). Members can't. */
  onPick?: (exerciseId: string, at: number) => void;
  /** In place of Pause / Continue (the builder's recorder). */
  controls?: ReactNode;
  /**
   * The builder's phone frame: in its flow rather than over it, so the frame
   * can grow to show the whole list (it scrolls once the frame is as tall as
   * it can be).
   */
  fit?: boolean;
  /** The builder: the warm-up's row lists its exercises (still lit and tapped as one). */
  listWarmup?: boolean;
  /** How far through the section: Continue fills with it. */
  fraction: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  /** The tip's CoachTip, taking no room: just above the buttons, at the right. */
  tip?: ReactNode;
  theater?: boolean;
  /**
   * The player: a tap on the title or the list goes by where it lands, as on
   * the tap zones (TAP_ZONES) under the rest of the screen — so the list,
   * which takes the finger to scroll, still pauses and moves on. A swipe
   * scrolls it, and isn't a tap.
   */
  onTap?: { back?: () => void; middle: () => void; next: () => void };
}) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // A long workout scrolls: as the instructor moves on, the exercise lit
  // glides to the middle of the list (as near as the list's ends allow), so
  // what follows shows too — the list only, never the page. Eased over
  // RUNDOWN_SCROLL_MS; a swipe or the wheel takes over from it.
  useEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>("[data-spotlit]");
    if (!box || !row) return;
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const most = box.scrollHeight - box.clientHeight;
    const target = Math.min(most, Math.max(0, top - (box.clientHeight - row.offsetHeight) / 2));
    const from = box.scrollTop;
    if (Math.abs(target - from) < 2) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function glide(now) {
      const t = Math.min(1, (now - started) / RUNDOWN_SCROLL_MS);
      // Ease in and out (cubic).
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      box.scrollTop = from + (target - from) * eased;
      if (t < 1) frame = requestAnimationFrame(glide);
    });
    const stop = () => cancelAnimationFrame(frame);
    box.addEventListener("wheel", stop, { passive: true });
    box.addEventListener("touchstart", stop, { passive: true });
    return () => {
      stop();
      box.removeEventListener("wheel", stop);
      box.removeEventListener("touchstart", stop);
    };
  }, [exerciseId]);
  // Fitting, the list's own height counts (flex-auto, not flex-1).
  const grow = fit ? "flex-auto" : "flex-1";
  // Where a tap on the list landed, across the whole screen: back, the middle, or next.
  const tap = (e: React.MouseEvent) => {
    const box = root.current?.getBoundingClientRect();
    if (!onTap || !box) return;
    const across = (e.clientX - box.left) / box.width;
    (across < TAP_ZONES.back ? onTap.back : across < 1 - TAP_ZONES.next ? onTap.middle : onTap.next)?.();
  };
  return (
    <div
      ref={root}
      className={`pointer-events-none flex flex-col [&_button]:pointer-events-auto ${
        fit ? "relative min-h-0 flex-auto" : "absolute inset-0"
      } ${theater ? "px-7 pt-12" : "px-4 pt-[calc(max(20px,env(safe-area-inset-top))+4px)]"}`}
    >
      {/* No box: the stage dims the loops behind (not blurred). The title stays put while the list scrolls. */}
      <div onClick={onTap ? tap : undefined} className={`pointer-events-auto flex min-h-0 ${grow} flex-col overflow-hidden`}>
        {/* Close under the top (moved up 18px, Oct 2026), so the list has that much more room. */}
        <div className="flex items-baseline justify-between gap-3 px-4 pb-1.5 pt-2">
          {/* Up a third from 17 and 15px (Oct 2026); the time in white, like the title. */}
          <h2 className="text-[22px] font-semibold">Workout Overview</h2>
          <span className="shrink-0 text-[19px]">~{minutes} min</span>
        </div>
        {/* It scrolls (a swipe, the wheel, or following the instructor) without showing a scroll bar. */}
        <div
          ref={list}
          className={`min-h-0 ${grow} overflow-y-auto overscroll-none px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          <WorkoutRows workout={workout} steps={steps} position={null} spotlight={{ exerciseId, onPick, listWarmup }} />
        </div>
      </div>
      {/* The buttons, on a rest's own bottom shade (so Pause looks as it does
          there), running on down to the screen's edge. */}
      <div className={`relative isolate mt-4 ${theater ? "-mx-7 px-7 pb-10" : `-mx-4 px-5 ${bottomPad}`}`}>
        <BottomShade />
        {tip && <div className="absolute bottom-full right-[13px] mb-3">{tip}</div>}
        {controls ?? (
          <CountdownControls
            paused={paused}
            onPause={onPause}
            onResume={onResume}
            goLabel="Continue"
            onGo={onContinue}
            fill={fraction}
          />
        )}
      </div>
    </div>
  );
}

// ── Intro, warm-up, cool-down, outro ──────────────────
// The videos that play once, start to finish, around the exercises. Each shows
// the same way: its chip and name, a plain video bar and a Skip that fills as
// it plays.

/** A video's own progress bar: a plain video bar, not the story segments. */
export function VideoProgress({ seconds, duration, label }: { seconds: number; duration: number; label: string }) {
  return (
    <TopBar>
      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(seconds)}
        className="h-1 overflow-hidden rounded-sm bg-white/30"
      >
        <div
          className="h-1 rounded-sm bg-white"
          style={{ width: `${duration ? Math.min(100, (seconds / duration) * 100) : 0}%`, transition: "width 250ms linear" }}
        />
      </div>
      <div className="flex justify-between text-[13px] font-medium tabular-nums text-white/80">
        <span>{clock(seconds)}</span>
        <span>{clock(Math.max(0, duration - seconds))} left</span>
      </div>
    </TopBar>
  );
}

/** A video's chip: "Warm-up" with its sun, "Cool-down" with its moon, "Intro", "Outro". */
export interface VideoChip {
  label: string;
  icon: ReactNode;
}

export function VideoScreen({
  chip,
  name,
  seconds,
  duration,
  skipLabel,
  onPause,
  onSkip,
  musicOn,
  onMusic,
  hidden,
  bar = true,
}: {
  chip: VideoChip;
  name: string;
  seconds: number;
  duration: number;
  /** "Skip warm-up", "Skip intro"… */
  skipLabel: string;
  onPause: () => void;
  onSkip: () => void;
  /** The music's playing (the music button shows it). */
  musicOn: boolean;
  /** The music button: music off or on. */
  onMusic: () => void;
  /** Controls swiped away: just the label, the name and a small Skip. */
  hidden: boolean;
  /** Its progress bar along the top, with the times under it — not on the intro or outro. */
  bar?: boolean;
}) {
  return (
    <>
      {bar && <VideoProgress seconds={seconds} duration={duration} label={chip.label} />}
      <div className={`absolute inset-x-0 bottom-0 isolate flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
        <BottomShade />
        <div className="flex flex-col gap-2">
          <span className="flex h-[26px] items-center gap-1.5 self-start rounded-full bg-white/[0.16] pl-[9px] pr-[11px] text-xs font-bold uppercase tracking-[0.08em]">
            {chip.icon}
            {chip.label}
          </span>
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold leading-tight">{name}</h1>
            {/* Minimised: a small Skip beside the name, filling as it plays. */}
            {hidden && (
              <MiniSkipButton
                progress={{ fraction: duration ? seconds / duration : 0, cycle: 0 }}
                onBegin={onSkip}
                label={skipLabel}
                aria={skipLabel}
              />
            )}
          </div>
        </div>
        <Collapse open={!hidden}>
          <div className="mt-[18px] flex items-center justify-between gap-3">
            <MusicButton on={musicOn} onClick={onMusic} />
            {/* Fills as the video plays, like Skip tutorial. */}
            <button
              type="button"
              onClick={onSkip}
              className="relative flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-base font-semibold backdrop-blur-md"
            >
              <ProgressFill fraction={duration ? seconds / duration : 0} />
              <span className="relative">{skipLabel}</span>
              <span className="relative">
                <ArrowRight size={18} />
              </span>
            </button>
            <RoundButton label="Pause" onClick={onPause}>
              <Pause />
            </RoundButton>
          </div>
        </Collapse>
      </div>
    </>
  );
}

// ── Get ready ─────────────────────────────────────────


/**
 * The few seconds before an exercise starts: GET READY, a ring counting
 * down, and what's coming — the exercise, its reps or time, the side, the
 * set and the dumbbell level — over its first frame, dimmed, so the member
 * can get into position. Start now skips the rest of it. On desktop it's
 * centred in the video column, like the rest screen.
 */
export function ReadyScreen({
  name,
  metric,
  side,
  setLine,
  levels,
  secondsLeft,
  totalSeconds,
  paused,
  onPause,
  onResume,
  onStart,
  theater = false,
}: {
  name: string;
  metric: { kind: "reps"; amount: number } | { kind: "time"; seconds: number };
  side: "right" | "left" | null;
  /** "Set 1 of 3", "Superset 1 · Round 2 of 3" — null for a single set. */
  setLine: string | null;
  /** "Light / Medium" — null when it takes no dumbbells. */
  levels: string | null;
  secondsLeft: number;
  totalSeconds: number;
  /** Held right here (Pause), the countdown stopped — see CountdownControls. */
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStart: () => void;
  theater?: boolean;
}) {
  const shown = Math.max(1, Math.ceil(secondsLeft));
  const [amount, unit] =
    metric.kind === "reps"
      ? [String(metric.amount), metric.amount === 1 ? "rep" : "reps"]
      : metric.seconds < 60
        ? [String(metric.seconds), "sec"]
        : [clock(metric.seconds), ""];
  const chip = "flex h-[30px] items-center rounded-full px-3 text-sm font-medium";
  return (
    <div
      className={`pointer-events-none [&_button]:pointer-events-auto ${theater ? centered : "absolute inset-0 flex flex-col"}`}
    >
      <div className={`flex flex-col items-center gap-[22px] px-6 text-center ${theater ? "" : "flex-1 justify-center pt-10"}`}>
        <CountdownTitle paused={paused}>Get ready</CountdownTitle>
        <div className="relative size-[200px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden="true">
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" />
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke="#A99CFF"
              strokeWidth="8"
              strokeLinecap="round"
              opacity={paused ? 0.45 : 1}
              strokeDasharray={RING}
              // Empties clockwise from 12 o'clock, like the rest ring.
              strokeDashoffset={-RING * (1 - (totalSeconds > 0 ? secondsLeft / totalSeconds : 0))}
              transform="rotate(-90 100 100)"
              style={{ transition: "stroke-dashoffset 250ms linear" }}
            />
          </svg>
          <div
            role="timer"
            aria-label={`Starting in ${shown} ${shown === 1 ? "second" : "seconds"}`}
            className="absolute inset-0 flex items-center justify-center text-[96px] font-semibold tracking-[-0.04em] tabular-nums"
          >
            {shown}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2.5">
          <h1 className="line-clamp-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]">{name}</h1>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{amount}</span>
            {unit && <span className="text-[22px] font-medium">{unit}</span>}
          </div>
          {(side || setLine || levels) && (
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {side && (
                <span className="flex h-[30px] items-center rounded-full bg-[#A99CFF] px-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[#14142B]">
                  {side} side
                </span>
              )}
              {setLine && <span className={`${chip} bg-white/[0.14]`}>{setLine}</span>}
              {levels && (
                <span className={`${chip} gap-1.5 bg-white/[0.14] pl-2.5`}>
                  <Dumbbell size={16} />
                  {levels}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={`relative gap-4 ${bottomGroup(theater)}`}>
        <CountdownControls
          paused={paused}
          onPause={onPause}
          onResume={onResume}
          goLabel="Start now"
          onGo={onStart}
        />
      </div>
    </div>
  );
}

// ── Restart the video? ────────────────────────────────

/**
 * A tap on the left side of the intro, warm-up, cool-down or outro: a small
 * card over the held video asking whether to start it over, with the buttons
 * stacked — Restart, Keep going (as is a tap outside, or Esc), and End workout
 * at the bottom.
 */
export function RestartVideoPrompt({
  title,
  onRestart,
  onCancel,
  onEnd,
}: {
  /** "Restart the warm-up?" */
  title: string;
  onRestart: () => void;
  onCancel: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0A0A1A]/50 px-6">
      <button type="button" aria-label="Keep going" onClick={onCancel} className="absolute inset-0 cursor-default" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="restart-video-title"
        className="relative w-full max-w-[320px] rounded-[24px] bg-[#1A1A34] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      >
        <h2 id="restart-video-title" className="text-center text-xl font-semibold">
          {title}
        </h2>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRestart}
            className="h-12 rounded-full bg-white text-base font-semibold text-[#14142B]"
          >
            Restart
          </button>
          <button type="button" autoFocus onClick={onCancel} className="h-12 rounded-full bg-white/[0.12] text-base font-semibold">
            Keep going
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="h-12 rounded-full bg-[#FF5A5A]/[0.14] text-base font-semibold text-[#FF9E9E]"
          >
            End workout
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cool down? ────────────────────────────────────────

/**
 * After the last exercise, when the workout has a cool-down: the workout's
 * done (the check, as on the summary) and a small card asks whether to cool
 * down — Yes plays it, No thanks moves on (to the outro, or the summary). Only
 * an answer moves it on; nothing plays meanwhile.
 */
export function CooldownPrompt({
  name,
  duration,
  onYes,
  onNo,
}: {
  name: string;
  /** The cool-down's length in seconds, if known. */
  duration: number | null;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cooldown-title"
        aria-describedby="cooldown-detail"
        className="flex w-full max-w-[340px] flex-col items-center gap-5 rounded-[28px] bg-[#1A1A34] p-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-[#A99CFF] text-[#14142B] shadow-[0_0_0_9px_rgba(169,156,255,0.2)]">
          <Check size={30} width={2.6} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#A99CFF]">Workout complete</div>
          <h2 id="cooldown-title" className="text-[28px] font-semibold leading-tight tracking-[-0.01em]">
            Cool down?
          </h2>
          <p id="cooldown-detail" className="text-[15px] text-white/75">
            {name}
            {duration ? ` · ${aboutMinutesLabel(duration)}` : ""}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            autoFocus
            onClick={onYes}
            className="flex h-[54px] items-center justify-center gap-2 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
          >
            Yes, cool down
          </button>
          <button type="button" onClick={onNo} className="h-[54px] rounded-full bg-white/[0.12] text-base font-semibold">
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

/** "5 min" — or "45 sec" for a short one. */
function aboutMinutesLabel(seconds: number): string {
  return seconds < 60 ? `${Math.round(seconds)} sec` : `${Math.max(1, Math.round(seconds / 60))} min`;
}

// ── Paused ────────────────────────────────────────────

export function PausedScreen({
  subtitle,
  stats,
  onResume,
  onRestartSet,
  restartSetLabel = "Restart this set",
  onRestartWorkout,
  onWatchTutorial,
  skip,
  onEnd,
  onSettings,
  music = null,
  theater = false,
}: {
  subtitle: string;
  stats: { elapsed: string; setsDone: string; left: string } | null;
  onResume: () => void;
  onRestartSet: (() => void) | null;
  /** "Restart tutorial" while a tutorial is on screen. */
  restartSetLabel?: string;
  onRestartWorkout: (() => void) | null;
  onWatchTutorial: (() => void) | null;
  /** On a video's pause screen: skip it ("Skip warm-up", "Skip intro"…). */
  skip: { label: string; onClick: () => void } | null;
  onEnd: () => void;
  onSettings: (() => void) | null;
  /** Phones: the music button, top left (desktop has it in the column beside the video). */
  music?: { on: boolean; onClick: () => void } | null;
  theater?: boolean;
}) {
  const secondary =
    "flex h-[54px] short:h-12 shrink-0 items-center justify-center gap-2.5 rounded-full bg-white/[0.12] text-base font-semibold";
  // On a short screen (an iPhone SE) everything tightens a little — the Play
  // button, the buttons, the gaps — so End workout still fits (`short:`).
  return (
    <>
      <div className={theater ? centered : "absolute inset-0 flex flex-col overflow-y-auto"}>
        {/* Phones: the whole stack, Paused to End workout, in the middle of the
            screen (between the corner buttons and the bottom edge) — or, where
            it doesn't fit, from just under the corner buttons, scrolling.
            Desktop's `centered` has it in the middle already. */}
        <div
          className={
            theater ? "contents" : `my-auto flex flex-col pt-[calc(max(20px,env(safe-area-inset-top))+18px)] ${bottomPad}`
          }
        >
          <div className={`flex flex-col items-center gap-5 ${theater ? "" : "pb-8 short:pb-6"}`}>
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="text-[30px] font-semibold tracking-[-0.01em]">Paused</h1>
              <div className="text-base text-white/75">{subtitle}</div>
            </div>
            <button
              type="button"
              aria-label="Resume workout"
              onClick={onResume}
              autoFocus
              className="flex size-[104px] items-center justify-center rounded-full bg-white text-[#14142B] shadow-[0_12px_36px_rgba(0,0,0,0.35)] short:size-[84px]"
            >
              <Play />
            </button>
          </div>
          <div className={`gap-3.5 short:gap-2.5 ${theater ? bottomGroup(true) : "flex flex-col px-5"}`}>
            {stats && (
              <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-white/[0.08] px-2 py-3.5 short:py-2.5">
                <Stat value={stats.elapsed} label="Elapsed" />
                <Stat value={stats.setsDone} label="Sets done" />
                <Stat value={stats.left} label="Left" />
              </div>
            )}
            {onRestartSet && (
              <button type="button" onClick={onRestartSet} className={secondary}>
                <RestartSet />
                {restartSetLabel}
              </button>
            )}
            {onRestartWorkout && (
              <button type="button" onClick={onRestartWorkout} className={secondary}>
                <RestartWorkout />
                Restart workout
              </button>
            )}
            {onWatchTutorial && (
              <button type="button" onClick={onWatchTutorial} className={secondary}>
                <WatchTutorial />
                Watch the tutorial
              </button>
            )}
            {skip && (
              <button type="button" onClick={skip.onClick} className={secondary}>
                {skip.label}
                <ArrowRight size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onEnd}
              className="flex h-12 shrink-0 items-center justify-center gap-2 text-base font-semibold text-[#FF9E9E] short:h-11"
            >
              <Exit />
              End workout
            </button>
          </div>
        </div>
      </div>
      {music && <CornerMusic on={music.on} onClick={music.onClick} />}
      {onSettings && <CornerSettings onClick={onSettings} />}
    </>
  );
}

function Stat({ value, label, big = false }: { value: string; label: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`${big ? "text-[26px]" : "text-[22px]"} font-semibold tabular-nums`}>{value}</span>
      <span className="text-[13px] text-white/70">{label}</span>
    </div>
  );
}

// ── Complete ──────────────────────────────────────────

export function CompleteScreen({
  title,
  time,
  exercises,
  sets,
  onDone,
  onRestart = null,
  rating = null,
  badge = false,
  onFireworkBurst,
  theater = false,
}: {
  title: string;
  time: string;
  exercises: number;
  sets: number;
  onDone: () => void;
  /** Restart workout, under Done — none for now (Oct 2026): it's left out. */
  onRestart?: (() => void) | null;
  /** The viewer's stars for this workout (null until they rate) and how to rate. Signed out (/demo1) they show but aren't kept. */
  rating?: { stars: number | null; onRate: (stars: number) => void } | null;
  /** The spinning 3D 1st Workout badge in place of the check (the check still shows if 3D can't run). */
  badge?: boolean;
  /** Each firework's burst, to time its pop to (see Fireworks). */
  onFireworkBurst?: (x: number, inSeconds: number) => void;
  theater?: boolean;
}) {
  const check = (
    <div className="flex size-[104px] items-center justify-center rounded-full bg-[#A99CFF] text-[#14142B] shadow-[0_0_0_12px_rgba(169,156,255,0.2)]">
      <Check size={48} width={2.6} />
    </div>
  );
  return (
    <>
      <Fireworks onBurst={onFireworkBurst} />
      <div className={theater ? centered : `absolute inset-0 flex flex-col gap-6 overflow-y-auto px-5 pt-[72px] ${bottomPad}`}>
        {/* Phones: allowed to shrink below its contents (min-h-0), which only the badge can do. */}
        <div className={`flex flex-col items-center gap-7 ${theater ? "w-[380px] max-w-[calc(100%-40px)]" : "min-h-0 flex-1 justify-center"}`}>
          {badge ? (
            // The canvas leaves room round the badge for its tilt; the negative
            // margin takes that back out of the spacing. A soft lilac glow behind.
            // Square from its height: 184px, but on a phone short of room (Safari's
            // toolbars) it gives up just what's missing, down to 120px, so the
            // buttons stay on screen; nothing else shrinks. Past that, it scrolls.
            <div className="-my-3 flex aspect-square h-[184px] min-h-[120px] shrink items-center justify-center bg-[radial-gradient(closest-side,rgba(169,156,255,0.22),transparent)]">
              <FirstWorkoutBadge fallback={check} className="size-full" />
            </div>
          ) : (
            check
          )}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.015em]">Workout complete!</h1>
            <div className="text-[17px] text-white/75">{title}</div>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 rounded-[18px] bg-white/[0.08] px-2 py-4">
            <Stat big value={time} label="Time" />
            <Stat big value={String(exercises)} label={exercises === 1 ? "Exercise" : "Exercises"} />
            <Stat big value={String(sets)} label={sets === 1 ? "Set" : "Sets"} />
          </div>
          {rating && <RateStars stars={rating.stars} onRate={rating.onRate} />}
        </div>
        <div className={`flex flex-col gap-3 ${theater ? "w-[380px] max-w-[calc(100%-40px)]" : ""}`}>
          <button
            type="button"
            onClick={onDone}
            autoFocus
            className="h-[58px] rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
          >
            Done
          </button>
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-white/[0.12] text-base font-semibold"
            >
              <RestartWorkout />
              Restart workout
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// The fireworks' colours: the badge's gold, the player's lilac, the mark's cyan, and a warm white.
const GOLD = "#FFD37A";
const LILAC = "#B7ABFF";
const CYAN = "#7FE7EC";
const WHITE = "#FFF4DC";

/**
 * Where each firework bursts (% of the screen, all in its top half: the first
 * right behind the badge), how wide it grows (% of the screen's width), when
 * it first goes up and how long each go takes (s), and the colours of its
 * three sets of dots. The lengths differ a little so the repeats drift apart.
 */
const FIREWORKS = [
  { x: 50, y: 22, size: 58, delay: 0.15, dur: 2.1, colors: [GOLD, WHITE, GOLD] },
  { x: 22, y: 14, size: 40, delay: 0.6, dur: 2.3, colors: [LILAC, CYAN, LILAC] },
  { x: 79, y: 30, size: 44, delay: 1.0, dur: 1.9, colors: [CYAN, GOLD, WHITE] },
  { x: 28, y: 38, size: 36, delay: 1.5, dur: 2.2, colors: [GOLD, LILAC, GOLD] },
  { x: 73, y: 11, size: 38, delay: 1.9, dur: 2.0, colors: [WHITE, LILAC, CYAN] },
];
/** How many times each goes up before they stop. */
const FIREWORK_ROUNDS = 3;
/** How far into each go it bursts, after rising: keep in step with the 45% in globals.css @keyframes firework. */
const BURST_AT = 0.45;

/**
 * One burst's dots, as background layers for globals.css .firework: three
 * rings, each dot in the element's own colour, spreading from the middle of
 * the box out to the edge as it grows.
 */
const BURST = [ring(14, 1, 0), ring(10, 0.72, 0.5), ring(6, 0.42, 0.25)]
  .flat()
  .map(([x, y]) => `radial-gradient(circle closest-side, currentColor 92%, #0000) ${x}% ${y}% / var(--dot) var(--dot) no-repeat`)
  .join(", ");

/** `n` dots evenly round a circle of radius `r` (1 = the box's edge), turned by `offset` of a step. */
function ring(n: number, r: number, offset: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + offset) / n) * 2 * Math.PI;
    return [Math.round((50 + 50 * r * Math.cos(a)) * 10) / 10, Math.round((50 + 50 * r * Math.sin(a)) * 10) / 10];
  });
}

/**
 * Fireworks over the Workout complete screen's top half, behind everything on
 * it: each rises from the bottom as a spark and bursts, a few times over, then
 * they stop. Sized to the screen (the video column), so a phone and the desktop
 * column look alike. None with reduced motion. `onBurst` hears of each burst
 * as its go starts (the browser's own animation events, so it keeps time with
 * what's on screen): where it is across the screen and how soon it bursts.
 */
function Fireworks({ onBurst }: { onBurst?: (x: number, inSeconds: number) => void }) {
  function goesUp(e: AnimationEvent<HTMLDivElement>, f: (typeof FIREWORKS)[number]) {
    if (e.animationName === "firework" && !e.pseudoElement) onBurst?.(f.x, f.dur * BURST_AT);
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size] motion-reduce:hidden"
      style={
        {
          "--burst": BURST,
          "--dot": "max(2px, 0.6cqmin)",
          "--fall": "3cqh",
          "--rounds": FIREWORK_ROUNDS,
        } as CSSProperties
      }
    >
      {FIREWORKS.map((f, i) => (
        <div
          key={i}
          className="firework"
          // Each go: as it starts, and as each repeat starts (not its dots' own animations).
          onAnimationStart={(e) => goesUp(e, f)}
          onAnimationIteration={(e) => goesUp(e, f)}
          style={
            {
              "--x": `${f.x}%`,
              "--y": `${f.y}%`,
              // From the bottom of the screen up to where it bursts.
              "--rise": `${100 - f.y}cqh`,
              "--size": `${f.size}cqw`,
              "--delay": `${f.delay}s`,
              "--dur": `${f.dur}s`,
              "--c1": f.colors[0],
              "--c2": f.colors[1],
              "--c3": f.colors[2],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Rate the workout out of five: tap a star (again to change it). Saved as
 * soon as it's tapped; hovering previews on desktop.
 */
function RateStars({ stars, onRate }: { stars: number | null; onRate: (stars: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? stars ?? 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[15px] font-medium text-white/75">Rate this workout</div>
      <div role="radiogroup" aria-label="Rate this workout" className="flex gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            onClick={() => onRate(n)}
            onMouseEnter={() => setHover(n)}
            className={`flex size-12 items-center justify-center rounded-full transition ${
              n <= shown ? "text-[#A99CFF]" : "text-white/40 hover:text-white/60"
            }`}
          >
            <Star filled={n <= shown} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sheets ────────────────────────────────────────────

export type SheetVariant = "bottom" | "side" | "dialog";

/**
 * Swipe a bottom sheet down to close it. The drag starts from anywhere on the
 * sheet — on a scrolling list only once it's scrolled to the top, so swiping
 * still scrolls the list first. Let go past 90px (or with a quick flick) and it
 * slides away and closes; any less and it springs back. Touch only: on desktop
 * sheets aren't bottom sheets. Mark scrolling areas with `data-sheet-scroll`.
 */
function useSwipeToClose(
  panel: RefObject<HTMLElement | null>,
  backdrop: RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled: boolean,
) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const el = panel.current;
    if (!enabled || !el) return;
    let start: { y: number; t: number; scroller: HTMLElement | null } | null = null;
    let dy = 0;
    let dragging = false;

    const place = (y: number, animate: boolean) => {
      const ease = animate ? "200ms ease-out" : "none";
      el.style.transition = animate ? `transform ${ease}` : "none";
      el.style.transform = y ? `translateY(${y}px)` : "";
      if (backdrop.current) {
        backdrop.current.style.transition = animate ? `opacity ${ease}` : "none";
        backdrop.current.style.opacity = String(Math.max(0, 1 - y / el.offsetHeight));
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target instanceof Element ? e.target : null;
      start = {
        y: e.touches[0].clientY,
        t: e.timeStamp,
        scroller: target?.closest<HTMLElement>("[data-sheet-scroll]") ?? null,
      };
      dy = 0;
      dragging = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      dy = e.touches[0].clientY - start.y;
      if (!dragging) {
        const atTop = !start.scroller || start.scroller.scrollTop <= 0;
        if (dy > 6 && atTop) dragging = true;
        else if (Math.abs(dy) > 6) start = null; // a scroll, not a swipe
        if (!dragging) return;
      }
      e.preventDefault();
      place(Math.max(0, dy), false);
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || !dragging) {
        start = null;
        return;
      }
      const flick = dy / Math.max(1, e.timeStamp - start.t) > 0.5;
      start = null;
      dragging = false;
      if (dy > 90 || (flick && dy > 30)) {
        place(el.offsetHeight, true);
        window.setTimeout(() => close.current(), 200);
      } else {
        place(0, true);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [panel, backdrop, enabled]);
}

/** Where each kind of sheet slides in from, and back out to. */
const OFFSTAGE: Record<SheetVariant, string> = {
  bottom: "translateY(100%)",
  side: "translateX(100%)",
  dialog: "scale(0.96)",
};

/** Closes the sheet this is inside, with its slide-out. */
const SheetDismiss = createContext<(() => void) | null>(null);

/**
 * A sheet over the stage: from the bottom on phones; on desktop a panel down
 * the right side, or a dialog in the middle. It slides in when it opens and
 * back out however it's closed — the ✕, a tap on the dimmed area, or (bottom
 * sheets) a swipe down.
 */
export function Sheet({
  label,
  onClose,
  children,
  alert = false,
  variant = "bottom",
  slideIn = true,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  alert?: boolean;
  variant?: SheetVariant;
  /**
   * Slide in when it opens. Off for the sheets a button opens (tutorial
   * settings, End workout), which just appear; they still slide out.
   */
  slideIn?: boolean;
}) {
  const panel = {
    bottom: `max-h-[88%] w-full rounded-t-[28px] bg-[#1A1A34] pt-2.5 ${bottomPad}`,
    side: "h-full w-[440px] max-w-full bg-[#17172F] py-7 shadow-[-24px_0_60px_rgba(0,0,0,0.45)]",
    dialog:
      "max-h-[90%] w-[420px] max-w-[calc(100%-32px)] rounded-[28px] bg-[#1A1A34] pb-6 pt-8 shadow-[0_30px_80px_rgba(0,0,0,0.5)]",
  }[variant];
  const place = { bottom: "flex-col justify-end", side: "justify-end", dialog: "items-center justify-center" }[variant];
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useSwipeToClose(panelRef, backdropRef, onClose, variant === "bottom");

  const closing = useRef(false);
  const dismiss = useCallback(() => {
    const el = panelRef.current;
    if (closing.current) return;
    closing.current = true;
    if (el) {
      el.style.transition = "transform 220ms ease-in, opacity 220ms ease-in";
      el.style.transform = OFFSTAGE[variant];
      if (variant === "dialog") el.style.opacity = "0";
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = "opacity 220ms ease-in";
      backdropRef.current.style.opacity = "0";
    }
    window.setTimeout(() => close.current(), 220);
  }, [variant]);

  // Slide in: start off-screen, let that frame paint, then transition in.
  useLayoutEffect(() => {
    const el = panelRef.current;
    const backdrop = backdropRef.current;
    if (!el || !backdrop) return;
    if (!slideIn || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.willChange = "transform";
    el.style.transform = OFFSTAGE[variant];
    if (variant === "dialog") el.style.opacity = "0";
    backdrop.style.opacity = "0";
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out";
        el.style.transform = "";
        el.style.opacity = "";
        backdrop.style.transition = "opacity 250ms ease-out";
        backdrop.style.opacity = "";
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [variant, slideIn, dismiss]);


  return (
    <SheetDismiss.Provider value={dismiss}>
      <div className={`absolute inset-0 z-20 flex ${place}`}>
        <div
          ref={backdropRef}
          className={`absolute inset-0 ${variant === "bottom" ? "bg-[#080814]/60" : "bg-[#06060E]/55"}`}
          onClick={dismiss}
          aria-hidden="true"
        />
        <section
          ref={panelRef}
          role={alert ? "alertdialog" : "dialog"}
          aria-modal="true"
          aria-label={label}
          className={`relative flex flex-col gap-4 ${panel}`}
        >
          {variant === "bottom" && <div className="h-[5px] w-10 shrink-0 self-center rounded-full bg-white/[0.28]" />}
          {children}
        </section>
      </div>
    </SheetDismiss.Provider>
  );
}

/**
 * The overview on phones: a bottom sheet that's always in the page, parked
 * just below the screen. Opening it — pulled up by the finger, or from the Up
 * next button — only slides it; nothing is built or re-rendered mid-gesture,
 * which is what made it stutter when it mounted on the swipe. Closes with a
 * swipe down, the ✕ or a tap on the dimmed area, sliding back down.
 */
export function Drawer({
  label,
  open,
  pull,
  onOpen,
  onClose,
  alert = false,
  fromTop = false,
  children,
}: {
  label: string;
  open: boolean;
  /** The overview's: following the finger up. The other drawers open from a button. */
  pull?: SheetPull;
  /** A pull went far (or fast) enough: it's now open. */
  onOpen?: () => void;
  onClose: () => void;
  alert?: boolean;
  /** Each time it opens, its list (`data-sheet-scroll`) starts at the top again — Settings, End workout. */
  fromTop?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onOpen, onClose });
  useEffect(() => {
    handlers.current = { onOpen, onClose };
  });
  useSwipeToClose(panelRef, backdropRef, onClose, open);

  const slide = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
  const fade = "opacity 250ms ease-out";

  // Follow the finger while it pulls, then settle open or back down.
  useEffect(() => {
    const el = panelRef.current;
    const backdrop = backdropRef.current;
    if (!el || !backdrop || !pull) return;
    return pull.attach({
      move: (distance) => {
        const h = el.offsetHeight;
        el.style.transition = "none";
        backdrop.style.transition = "none";
        el.style.transform = `translateY(${Math.max(0, h - distance)}px)`;
        backdrop.style.opacity = String(Math.min(1, distance / h));
      },
      end: (distance, velocity) => {
        const opening = distance > 80 || velocity > 0.4;
        el.style.transition = slide;
        backdrop.style.transition = fade;
        el.style.transform = opening ? "translateY(0px)" : "translateY(100%)";
        backdrop.style.opacity = opening ? "1" : "0";
        if (opening) handlers.current.onOpen?.();
      },
    });
  }, [pull, slide, fade]);

  // Opened or closed from outside (a button, a jump, Escape): slide there. The
  // first run just parks it, before anything is painted.
  const placed = useRef(false);
  useLayoutEffect(() => {
    const el = panelRef.current;
    const backdrop = backdropRef.current;
    if (!el || !backdrop) return;
    const animate = placed.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    placed.current = true;
    el.style.transition = animate ? slide : "none";
    backdrop.style.transition = animate ? fade : "none";
    el.style.transform = open ? "translateY(0px)" : "translateY(100%)";
    backdrop.style.opacity = open ? "1" : "0";
    // Back at the top before it slides in (still below the screen, so the jump never shows).
    if (open && fromTop) {
      const list = el.querySelector<HTMLElement>("[data-sheet-scroll]");
      if (list) list.scrollTop = 0;
    }
    // Focus the sheet's marked default (End workout's Cancel), else its first button.
    if (open) {
      (el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("button"))?.focus({
        preventScroll: true,
      });
    }
  }, [open, slide, fade, fromTop]);

  return (
    <SheetDismiss.Provider value={onClose}>
      <div className={`absolute inset-0 z-20 flex flex-col justify-end ${open ? "" : "pointer-events-none"}`} inert={!open}>
        <div
          ref={backdropRef}
          className="absolute inset-0 bg-[#080814]/60 will-change-[opacity]"
          style={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden="true"
        />
        <section
          ref={panelRef}
          role={alert ? "alertdialog" : "dialog"}
          aria-modal={open}
          aria-label={label}
          aria-hidden={!open}
          className={`relative flex max-h-[88%] w-full flex-col gap-4 rounded-t-[28px] bg-[#1A1A34] pt-2.5 will-change-transform ${bottomPad}`}
          style={{ transform: "translateY(100%)" }}
        >
          <div className="h-[5px] w-10 shrink-0 self-center rounded-full bg-white/[0.28]" />
          {children}
        </section>
      </div>
    </SheetDismiss.Provider>
  );
}

/** An on/off switch in the style of the phone's own settings. */
export function Switch({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed ${on ? "bg-[#A99CFF]" : "bg-white/20"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform duration-200 ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

/** A button that closes the sheet it's in, sliding it away. */
function DismissButton({ className, children, ...rest }: ComponentProps<"button">) {
  const dismiss = useContext(SheetDismiss);
  return (
    <button type="button" {...rest} onClick={() => dismiss?.()} className={className}>
      {children}
    </button>
  );
}

export function SheetClose({ label }: { label: string }) {
  return (
    <DismissButton
      aria-label={label}
      autoFocus
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10"
    >
      <Close />
    </DismissButton>
  );
}

const MODES: Array<{ id: TutorialMode; title: string; desc: string }> = [
  { id: "loop", title: "Loop", desc: "The tutorial repeats until you tap to start." },
  { id: "once", title: "Play once", desc: "Plays through once, then the exercise starts on its own." },
  { id: "off", title: "Off", desc: "Go straight to the exercise. Watch the tutorial anytime from the pause screen." },
];

/**
 * A button-opened sheet: on phones a drawer, always mounted and sliding open
 * and shut like the overview (pass `drawerOpen`); on desktop a side panel or
 * dialog, mounted while open, that just appears.
 */
function SheetFrame({
  label,
  onClose,
  alert = false,
  variant,
  drawerOpen,
  children,
}: {
  label: string;
  onClose: () => void;
  alert?: boolean;
  variant: SheetVariant;
  drawerOpen?: boolean;
  children: ReactNode;
}) {
  return drawerOpen === undefined ? (
    <Sheet label={label} onClose={onClose} alert={alert} variant={variant} slideIn={false}>
      {children}
    </Sheet>
  ) : (
    <Drawer label={label} open={drawerOpen} onClose={onClose} alert={alert} fromTop>
      {children}
    </Drawer>
  );
}

/** A card with a title, an optional line under it, and a switch — Settings and the Audio card. */
function SwitchRow({
  title,
  text,
  on,
  onChange,
  disabled = false,
}: {
  title: string;
  text?: ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border-[1.5px] border-white/[0.12] bg-white/[0.04] px-4 py-3.5 transition-opacity ${
        disabled ? "opacity-45" : ""
      }`}
    >
      <span className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[17px] font-semibold">{title}</span>
        {text && <span className="text-sm leading-snug text-white/75">{text}</span>}
      </span>
      <Switch on={on} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

type Toggle = { on: boolean; onChange: (on: boolean) => void };

type AudioToggles = {
  muteAll: Toggle;
  music: Toggle;
  /** The instructor's audio tips ("Instructor audio"). */
  tips: Toggle;
  announcements: Toggle;
  effects: Toggle;
  /** "Keep my music playing" — null where the browser can't (the switch is hidden). */
  mix: Toggle | null;
};

/**
 * Settings' first section: what plays — music, the instructor's audio (their
 * tips), voice announcements, sound effects (the countdown, the chimes),
 * other apps' music alongside — and last Mute all, which silences everything
 * (the switches above dim while it's on, and keep their settings for when
 * it's off). Once the Audio card's, from the audio button, which now turns
 * the music on and off.
 */
function AudioSwitches({ muteAll, music, tips, announcements, effects, mix }: AudioToggles) {
  const off = muteAll.on;
  return (
    <>
      <SwitchRow title="Music" {...music} disabled={off} />
      <SwitchRow title="Instructor audio" {...tips} disabled={off} />
      <SwitchRow title="Voice announcements" {...announcements} disabled={off} />
      <SwitchRow title="Sound effects" {...effects} disabled={off} />
      {mix && (
        <SwitchRow
          title="Keep my music playing"
          text={
            <>
              Audio instructions will play without pausing music from other apps.
              <span className="mt-1 block font-semibold">Phone silent mode must be OFF.</span>
            </>
          }
          {...mix}
          disabled={off}
        />
      )}
      <div className="mt-1">
        <SwitchRow title="Mute all" text="No sound from the workout at all." {...muteAll} />
      </div>
    </>
  );
}

export function SettingsSheet({
  audio,
  mode,
  onMode,
  autoAdvance,
  onGuide,
  onClose,
  variant = "bottom",
  drawerOpen,
}: {
  /** The sound switches, first (see AudioSwitches). */
  audio: AudioToggles;
  mode: TutorialMode;
  onMode: (mode: TutorialMode) => void;
  autoAdvance: Toggle;
  /** Show the gesture guide again (phones only; null on desktop). */
  onGuide: (() => void) | null;
  onClose: () => void;
  variant?: SheetVariant;
  /** Phones: always mounted as a drawer that slides open and shut — pass whether it's open. */
  drawerOpen?: boolean;
}) {
  return (
    <SheetFrame label="Settings" onClose={onClose} variant={variant} drawerOpen={drawerOpen}>
      <div className={`flex items-center justify-between gap-3 ${variant === "side" ? "px-7" : "px-5"}`}>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Settings</h2>
        <SheetClose label="Close settings" />
      </div>
      <div
        data-sheet-scroll
        // Scrolls without showing a scroll bar, like the overviews' lists.
        className={`flex min-h-0 flex-col gap-[18px] overflow-y-auto overscroll-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          variant === "side" ? "px-7" : "px-5"
        }`}
      >
        <section aria-labelledby="settings-audio" className="flex flex-col gap-3">
          <h3 id="settings-audio" className="text-base font-semibold">
            Audio
          </h3>
          <AudioSwitches {...audio} />
        </section>
        <section aria-labelledby="settings-exercises" className="flex flex-col gap-3">
          <h3 id="settings-exercises" className="text-base font-semibold">
            Exercises
          </h3>
          <SwitchRow
            title="Auto-advance"
            text="Rep sets move on by themselves after the time the reps usually take. Tap to move on sooner."
            {...autoAdvance}
          />
        </section>
        {TUTORIAL_CONTROLS && (
          <section aria-labelledby="settings-tutorials" className="flex flex-col gap-3">
            <h3 id="settings-tutorials" className="text-base font-semibold">
              Tutorials
            </h3>
            <fieldset className="flex min-w-0 flex-col gap-2.5">
              <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
                Before each new exercise
              </legend>
              {MODES.map((m) => {
                // Loop waits for a tap, which auto-advance is meant to avoid.
                const blocked = m.id === "loop" && autoAdvance.on;
                return (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 ${
                      blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    } ${mode === m.id ? "border-[#A99CFF]/85 bg-[#A99CFF]/[0.14]" : "border-white/[0.12] bg-white/[0.04]"}`}
                  >
                    <input
                      type="radio"
                      name="tutorial-mode"
                      value={m.id}
                      checked={mode === m.id}
                      disabled={blocked}
                      onChange={() => !blocked && onMode(m.id)}
                      className="mt-px size-5 shrink-0 accent-[#A99CFF]"
                    />
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="text-[17px] font-semibold">{m.title}</span>
                      <span className="text-sm leading-snug text-white/75">
                        {blocked ? "Turn off Auto-advance to use Loop." : m.desc}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </section>
        )}
        {onGuide && (
          <section aria-labelledby="settings-help" className="flex flex-col gap-3">
            <h3 id="settings-help" className="text-base font-semibold">
              Help
            </h3>
            <button
              type="button"
              onClick={onGuide}
              className="flex items-center justify-between gap-4 rounded-2xl border-[1.5px] border-white/[0.12] bg-white/[0.04] px-4 py-3.5 text-left"
            >
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[17px] font-semibold">How to use the player</span>
                <span className="text-sm leading-snug text-white/75">
                  {variant === "bottom" ? "The taps, swipes and settings, again." : "The controls and settings, again."}
                </span>
              </span>
              <ChevronRight />
            </button>
          </section>
        )}
      </div>
    </SheetFrame>
  );
}

export function EndSheet({
  setsDone,
  setsTotal,
  canSave,
  onEnd,
  onCancel,
  variant = "bottom",
  drawerOpen,
}: {
  setsDone: number;
  setsTotal: number;
  /**
   * Offer Save progress / Discard progress (signed in, past the first set);
   * otherwise it's just End workout.
   */
  canSave: boolean;
  /** Leave the workout, keeping the progress for Resume or not. */
  onEnd: (keep: boolean) => void;
  /** Back to the pause screen. */
  onCancel: () => void;
  variant?: SheetVariant;
  /** Phones: always mounted as a drawer that slides open and shut — pass whether it's open. */
  drawerOpen?: boolean;
}) {
  return (
    <SheetFrame label="End workout?" onClose={onCancel} alert variant={variant} drawerOpen={drawerOpen}>
      <div className={`flex flex-col gap-[22px] ${variant === "dialog" ? "px-7" : "px-5"}`}>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[26px] font-semibold tracking-[-0.01em]">End workout?</h2>
          <p className="max-w-[300px] text-base leading-[1.45] text-white/75">
            You&rsquo;ve done {setsDone} of {setsTotal} sets.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {canSave && (
            <button
              type="button"
              onClick={() => onEnd(true)}
              className="h-[54px] rounded-full bg-white text-base font-semibold text-[#14142B]"
            >
              Save progress
            </button>
          )}
          <button
            type="button"
            onClick={() => onEnd(false)}
            className="h-[54px] rounded-full bg-[#FF5A5A]/[0.14] text-base font-semibold text-[#FF9E9E]"
          >
            {canSave ? "Discard progress" : "End workout"}
          </button>
          <DismissButton autoFocus data-autofocus className="h-12 text-base font-semibold text-white/80">
            Cancel
          </DismissButton>
        </div>
      </div>
    </SheetFrame>
  );
}
