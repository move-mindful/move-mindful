"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import type { TutorialMode } from "@move-mindful/core";
import { clock } from "@/lib/workouts/player";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ChevronUp,
  Close,
  Dumbbell,
  Exit,
  Loop,
  Pause,
  Play,
  RestartSet,
  RestartWorkout,
  Sun,
  Settings,
  Sound,
  Muted,
  WatchTutorial,
} from "./icons";

// The player's screens, drawn from the player design canvas (mobile frames).
// Each fills the 9:16 stage the videos play in; none of them knows about the
// state machine — workout-player.tsx works out what to show and passes it in.

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

/** Instructor audio on or off — the same setting as in Settings, a tap away. */
function SoundButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <RoundButton label={muted ? "Turn instructor audio on" : "Turn instructor audio off"} onClick={onToggle}>
      {muted ? <Muted /> : <Sound />}
    </RoundButton>
  );
}

/** Sound · Up next (opens the overview) · Pause. */
function ControlsRow({
  pill,
  fill = null,
  muted,
  onPause,
  onOverview,
  onToggleSound,
}: {
  pill: { label: string; text: string };
  /** How far until the set moves on by itself (auto-advance, a timed set): Up next fills with it. */
  fill?: number | null;
  muted: boolean;
  onPause: () => void;
  onOverview: () => void;
  onToggleSound: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <SoundButton muted={muted} onToggle={onToggleSound} />
      <button
        type="button"
        aria-label={`Open workout overview. ${pill.label}: ${pill.text}`}
        onClick={onOverview}
        className="relative flex h-[52px] min-w-0 items-center gap-2.5 overflow-hidden rounded-full border border-white/20 bg-white/10 pl-3.5 pr-5 text-left backdrop-blur-md"
      >
        {fill !== null && <ProgressFill fraction={fill} />}
        <span className="relative">
          <ChevronUp />
        </span>
        <span className="relative flex min-w-0 flex-col gap-px">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{pill.label}</span>
          <span className="truncate text-[15px] font-medium">{pill.text}</span>
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
 * it names, trimmed to fit.
 */
/** A bold capitals pill ("Up next", "Tutorial") and a line of text beside it — phones' minimised views and desktop's info. */
export function LabelLine({
  label,
  text,
  fill = null,
  className = "",
}: {
  label: string;
  text: string;
  /** Fill the label pill with a countdown's progress (Up next, moving on by itself). */
  fill?: number | null;
  className?: string;
}) {
  return (
    <p className={`flex min-w-0 items-center gap-2 ${className}`}>
      {/* As tall as the chips below it, a shade brighter and in bold capitals. */}
      <span className="relative flex h-[30px] shrink-0 items-center overflow-hidden rounded-full bg-white/[0.24] px-3 text-[13px] font-bold uppercase tracking-[0.08em]">
        {fill !== null && <ProgressFill fraction={fill} />}
        <span className="relative">{label}</span>
      </span>
      <span className="min-w-0 truncate text-[15px] font-medium">{text}</span>
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
  muted,
  onToggleSound,
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
  muted: boolean;
  onToggleSound: () => void;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 isolate flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
      <BottomShade />
      {groupLine && (
        <Collapse open={!hidden}>
          <div className="mb-2 flex items-center gap-[7px] text-[13px] font-semibold tracking-[0.02em] text-[#A99CFF]">
            <Loop size={14} />
            {groupLine}
          </div>
        </Collapse>
      )}
      <div className="flex items-center gap-3">
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
        {side && (
          <span className="flex h-7 items-center rounded-full bg-[#A99CFF] px-3 text-[13px] font-bold tracking-[0.08em] text-[#14142B]">
            {side.toUpperCase()}
          </span>
        )}
      </div>
      {/* Controls swiped away: what's next, under the reps. */}
      <Collapse open={hidden}>
        <LabelLine label={pill.label} text={pill.text} fill={fill} className="mt-2" />
      </Collapse>
      <Collapse open={!hidden}>
        <h1 className="mt-1 truncate text-xl font-semibold leading-tight">{name}</h1>
        <div className="mt-[18px]">
          <ControlsRow
            pill={pill}
            fill={fill}
            muted={muted}
            onPause={onPause}
            onOverview={onOverview}
            onToggleSound={onToggleSound}
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
  pill,
  hidden,
  onBegin,
  onPause,
  onOverview,
  muted,
  onToggleSound,
}: {
  name: string;
  chips: string[];
  levels: string | null;
  /** How far through the tutorial is, and the seconds left of it. */
  progress: TutorialProgress;
  pill: { label: string; text: string };
  /** Controls swiped away: just the sets and reps left over the video. */
  hidden: boolean;
  onBegin: () => void;
  onPause: () => void;
  onOverview: () => void;
  muted: boolean;
  onToggleSound: () => void;
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
        <LabelLine label="Tutorial" text={name} className="mb-2.5" />
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
        <div className="mt-[18px] flex flex-col gap-[18px]">
          <BeginButton progress={progress} onBegin={onBegin} />
          <ControlsRow pill={pill} muted={muted} onPause={onPause} onOverview={onOverview} onToggleSound={onToggleSound} />
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
 * starts the exercise when that runs out; a looping one starts over.
 */
export function BeginButton({
  progress,
  onBegin,
  className = "",
}: {
  progress: TutorialProgress;
  onBegin: () => void;
  className?: string;
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
      className={`relative flex h-[58px] items-center justify-center gap-2.5 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-[17px] font-semibold ${className}`}
    >
      <ProgressFill fraction={progress.fraction} restartKey={progress.cycle} />
      <span className="relative">Skip tutorial</span>
      <span className="relative">
        <ArrowRight />
      </span>
      <span className="absolute inset-y-0 right-[22px] flex items-center text-[15px] font-medium tabular-nums text-white/80">
        {clock(Math.ceil(progress.secondsLeft))}
      </span>
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

const RING = 2 * Math.PI * 116;

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
}: {
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  goLabel: string;
  onGo: () => void;
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
          className="flex h-[58px] flex-[1.4] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
        >
          {goLabel}
          <ArrowRight />
        </button>
      </div>
    </>
  );
}


export function RestScreen({
  round,
  secondsLeft,
  totalSeconds,
  roundLine,
  next,
  paused,
  onPause,
  onResume,
  onContinue,
  theater = false,
}: {
  /** A group's rest between rounds, rather than an ordinary rest. */
  round: boolean;
  secondsLeft: number;
  totalSeconds: number;
  roundLine: string | null;
  next: { label: string; name: string; detail: string; thumbnail: string | null } | null;
  /** Held right here (Pause), the countdown stopped — see CountdownControls. */
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  theater?: boolean;
}) {
  const shown = Math.ceil(secondsLeft);
  return (
    <div
      className={`pointer-events-none [&_button]:pointer-events-auto ${theater ? centered : "absolute inset-0 flex flex-col"}`}
    >
      <div className={`flex flex-col items-center gap-[18px] ${theater ? "" : "flex-1 justify-center pt-12"}`}>
        {/* The same size as GET READY. */}
        <div className="flex items-center gap-2 text-xl font-bold uppercase tracking-[0.16em] text-[#A99CFF]">
          {round && <Loop size={20} />}
          {round ? "Round rest" : "Rest"}
          {paused && <span className="text-white/75">· Paused</span>}
        </div>
        <div className="relative size-[248px]">
          <svg viewBox="0 0 248 248" className="absolute inset-0 size-full" aria-hidden="true">
            <circle cx="124" cy="124" r="116" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" />
            <circle
              cx="124"
              cy="124"
              r="116"
              fill="none"
              stroke="#A99CFF"
              strokeWidth="8"
              strokeLinecap="round"
              opacity={paused ? 0.45 : 1}
              strokeDasharray={RING}
              // Negative, so the ring empties clockwise from 12 o'clock, like a
              // clock hand sweeping round.
              strokeDashoffset={-RING * (1 - (totalSeconds > 0 ? secondsLeft / totalSeconds : 0))}
              transform="rotate(-90 124 124)"
              style={{ transition: "stroke-dashoffset 250ms linear" }}
            />
          </svg>
          <div
            role="timer"
            aria-label={`${shown} seconds of rest left`}
            className="absolute inset-0 flex items-center justify-center text-[72px] font-semibold tracking-[-0.03em] tabular-nums"
          >
            {clock(shown)}
          </div>
        </div>
        {roundLine && <div className="text-base text-white/80">{roundLine}</div>}
      </div>
      <div className={`relative gap-4 ${bottomGroup(theater)}`}>
        {next && (
          <div className="flex items-center gap-3.5 rounded-[18px] bg-white/[0.08] py-2.5 pl-2.5 pr-4">
            <span className="h-[72px] w-14 shrink-0 overflow-hidden rounded-xl bg-white/10">
              {next.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element -- a tiny Mux still; nothing to optimize
                <img src={next.thumbnail} alt="" className="size-full object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70">{next.label}</span>
              <span className="truncate text-lg font-semibold">{next.name}</span>
              <span className="text-sm text-white/70">{next.detail}</span>
            </span>
          </div>
        )}
        <CountdownControls
          paused={paused}
          onPause={onPause}
          onResume={onResume}
          goLabel="Continue"
          onGo={onContinue}
        />
      </div>
    </div>
  );
}

// ── Warm-up ───────────────────────────────────────────

/** The warm-up's own progress bar: a plain video bar, not the story segments. */
export function WarmupProgress({ seconds, duration }: { seconds: number; duration: number }) {
  return (
    <TopBar>
      <div
        role="progressbar"
        aria-label="Warm-up progress"
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

export function WarmupScreen({
  name,
  seconds,
  duration,
  onPause,
  onSkip,
  muted,
  onToggleSound,
  hidden,
}: {
  name: string;
  seconds: number;
  duration: number;
  onPause: () => void;
  onSkip: () => void;
  muted: boolean;
  onToggleSound: () => void;
  /** Controls swiped away: just the label, the name and a small Skip. */
  hidden: boolean;
}) {
  return (
    <>
      <WarmupProgress seconds={seconds} duration={duration} />
      <div className={`absolute inset-x-0 bottom-0 isolate flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
        <BottomShade />
        <div className="flex flex-col gap-2">
          <span className="flex h-[26px] items-center gap-1.5 self-start rounded-full bg-white/[0.16] pl-[9px] pr-[11px] text-xs font-bold uppercase tracking-[0.08em]">
            <Sun size={14} />
            Warm-up
          </span>
          <div className="flex items-center gap-3">
            <h1 className="min-w-0 flex-1 truncate text-[22px] font-semibold leading-tight">{name}</h1>
            {/* Minimised: a small Skip beside the name, filling as it plays. */}
            {hidden && (
              <MiniSkipButton
                progress={{ fraction: duration ? seconds / duration : 0, cycle: 0 }}
                onBegin={onSkip}
                label="Skip warm-up"
                aria="Skip warm-up"
              />
            )}
          </div>
        </div>
        <Collapse open={!hidden}>
          <div className="mt-[18px] flex items-center justify-between gap-3">
            <SoundButton muted={muted} onToggle={onToggleSound} />
            {/* Fills as the warm-up plays, like Skip tutorial. */}
            <button
              type="button"
              onClick={onSkip}
              className="relative flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-base font-semibold backdrop-blur-md"
            >
              <ProgressFill fraction={duration ? seconds / duration : 0} />
              <span className="relative">Skip warm-up</span>
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

const READY_RING = 2 * Math.PI * 92;

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
        <div className="flex items-center gap-2 text-xl font-bold uppercase tracking-[0.16em] text-[#A99CFF]">
          Get ready
          {paused && <span className="text-white/75">· Paused</span>}
        </div>
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
              strokeDasharray={READY_RING}
              // Empties clockwise from 12 o'clock, like the rest ring.
              strokeDashoffset={-READY_RING * (1 - (totalSeconds > 0 ? secondsLeft / totalSeconds : 0))}
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

// ── Restart the warm-up? ──────────────────────────────

/**
 * A tap on the warm-up's left side: a small card over the held warm-up asking
 * whether to start it over, with the buttons stacked — Restart, Keep going
 * (as is a tap outside, or Esc), and End workout at the bottom.
 */
export function RestartWarmupPrompt({
  onRestart,
  onCancel,
  onEnd,
}: {
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
        aria-labelledby="restart-warmup-title"
        className="relative w-full max-w-[320px] rounded-[24px] bg-[#1A1A34] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      >
        <h2 id="restart-warmup-title" className="text-center text-xl font-semibold">
          Restart the warm-up?
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

// ── Paused ────────────────────────────────────────────

export function PausedScreen({
  subtitle,
  stats,
  onResume,
  onRestartSet,
  restartSetLabel = "Restart this set",
  onRestartWorkout,
  onWatchTutorial,
  onSkipWarmup,
  onEnd,
  onSettings,
  autoAdvance,
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
  onSkipWarmup: (() => void) | null;
  onEnd: () => void;
  onSettings: (() => void) | null;
  /** The AUTO › ON/OFF pill above "Paused", a quick switch for auto-advance (not on the warm-up's). */
  autoAdvance: { on: boolean; onChange: (on: boolean) => void } | null;
  theater?: boolean;
}) {
  const secondary =
    "flex h-[54px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-white/[0.12] text-base font-semibold";
  return (
    <>
      <div className={theater ? centered : "absolute inset-0 flex flex-col overflow-y-auto"}>
        <div className={`flex flex-col items-center gap-5 ${theater ? "" : "flex-1 justify-end pb-8 pt-16"}`}>
          <div className="flex flex-col items-center gap-1 text-center">
            {autoAdvance && <AutoPill on={autoAdvance.on} onChange={autoAdvance.onChange} />}
            <h1 className="text-[30px] font-semibold tracking-[-0.01em]">Paused</h1>
            <div className="text-base text-white/75">{subtitle}</div>
          </div>
          <button
            type="button"
            aria-label="Resume workout"
            onClick={onResume}
            autoFocus
            className="flex size-[104px] items-center justify-center rounded-full bg-white text-[#14142B] shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
          >
            <Play />
          </button>
        </div>
        <div className={`gap-3.5 ${bottomGroup(theater)}`}>
          {stats && (
            <div className="grid grid-cols-3 gap-2 rounded-[18px] bg-white/[0.08] px-2 py-3.5">
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
          {onSkipWarmup && (
            <button type="button" onClick={onSkipWarmup} className={secondary}>
              Skip warm-up
              <ArrowRight size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onEnd}
            className="flex h-12 shrink-0 items-center justify-center gap-2 text-base font-semibold text-[#FF9E9E]"
          >
            <Exit />
            End workout
          </button>
        </div>
      </div>
      {/* Settings, top right under the progress bar (not on the warm-up's). */}
      {onSettings && (
        <div className="absolute right-4 top-[calc(max(20px,env(safe-area-inset-top))+18px)] z-10">
          <SettingsButton onClick={onSettings} />
        </div>
      )}
    </>
  );
}

/** AUTO › ON / AUTO › OFF — tap to switch auto-advance. Lit in the accent while it's on. */
function AutoPill({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto-advance"
      onClick={() => onChange(!on)}
      className={`mb-2 flex h-[30px] items-center gap-1 rounded-full pl-3.5 pr-3 text-[13px] font-bold uppercase tracking-[0.08em] transition-colors ${
        on ? "bg-[#A99CFF]/25 text-[#DAD3FF] ring-1 ring-[#A99CFF]/60" : "bg-white/[0.14] text-white/75"
      }`}
    >
      Auto
      <ChevronRight size={14} />
      <span className="w-[2.1em] text-left">{on ? "On" : "Off"}</span>
    </button>
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
  onRestart,
  theater = false,
}: {
  title: string;
  time: string;
  exercises: number;
  sets: number;
  onDone: () => void;
  onRestart: () => void;
  theater?: boolean;
}) {
  return (
    <div className={theater ? centered : `absolute inset-0 flex flex-col gap-6 overflow-y-auto px-5 pt-[72px] ${bottomPad}`}>
      <div className={`flex flex-col items-center gap-7 ${theater ? "w-[380px] max-w-[calc(100%-40px)]" : "flex-1 justify-center"}`}>
        <div className="flex size-[104px] items-center justify-center rounded-full bg-[#A99CFF] text-[#14142B] shadow-[0_0_0_12px_rgba(169,156,255,0.2)]">
          <Check size={48} width={2.6} />
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.015em]">Workout complete</h1>
          <div className="text-[17px] text-white/75">{title}</div>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 rounded-[18px] bg-white/[0.08] px-2 py-4">
          <Stat big value={time} label="Time" />
          <Stat big value={String(exercises)} label={exercises === 1 ? "Exercise" : "Exercises"} />
          <Stat big value={String(sets)} label={sets === 1 ? "Set" : "Sets"} />
        </div>
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
        <button
          type="button"
          onClick={onRestart}
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-white/[0.12] text-base font-semibold"
        >
          <RestartWorkout />
          Restart workout
        </button>
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
    // Focus the sheet's marked default (End workout's Cancel), else its first button.
    if (open) {
      (el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("button"))?.focus({
        preventScroll: true,
      });
    }
  }, [open, slide, fade]);

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
export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-[#A99CFF]" : "bg-white/20"}`}
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
    <Drawer label={label} open={drawerOpen} onClose={onClose} alert={alert}>
      {children}
    </Drawer>
  );
}

export function SettingsSheet({
  mode,
  soundOn,
  mix,
  onMode,
  onSound,
  autoAdvance,
  onGuide,
  onClose,
  variant = "bottom",
  drawerOpen,
}: {
  mode: TutorialMode;
  soundOn: boolean;
  /** "Keep my music playing" — null where the browser can't (the switch is hidden). */
  mix: { on: boolean; onChange: (on: boolean) => void } | null;
  onMode: (mode: TutorialMode) => void;
  onSound: (on: boolean) => void;
  autoAdvance: { on: boolean; onChange: (on: boolean) => void };
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
        className={`flex min-h-0 flex-col gap-[18px] overflow-y-auto overscroll-contain ${variant === "side" ? "px-7" : "px-5"}`}
      >
        <section aria-labelledby="settings-sound" className="flex flex-col gap-3">
          <h3 id="settings-sound" className="text-base font-semibold">
            Sound
          </h3>
          <div className="flex items-center justify-between gap-4 rounded-2xl border-[1.5px] border-white/[0.12] bg-white/[0.04] px-4 py-3.5">
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[17px] font-semibold">Instructor audio</span>
              <span className="text-sm leading-snug text-white/75">Turn instructor audio on or off.</span>
            </span>
            <Switch on={soundOn} onChange={onSound} label="Instructor audio" />
          </div>
          {mix && (
            <div className="flex items-center justify-between gap-4 rounded-2xl border-[1.5px] border-white/[0.12] bg-white/[0.04] px-4 py-3.5">
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[17px] font-semibold">Keep my music playing</span>
                <span className="text-sm leading-snug text-white/75">
                  Audio instructions will play without pausing music from other apps.
                  <span className="mt-1 block font-semibold">Phone silent mode must be OFF.</span>
                </span>
              </span>
              <Switch on={mix.on} onChange={mix.onChange} label="Keep my music playing" />
            </div>
          )}
        </section>
        <section aria-labelledby="settings-exercises" className="flex flex-col gap-3">
          <h3 id="settings-exercises" className="text-base font-semibold">
            Exercises
          </h3>
          <div className="flex items-center justify-between gap-4 rounded-2xl border-[1.5px] border-white/[0.12] bg-white/[0.04] px-4 py-3.5">
            <span className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[17px] font-semibold">Auto-advance</span>
              <span className="text-sm leading-snug text-white/75">
                Rep sets move on by themselves after the time the reps usually take. Tap to move on sooner.
              </span>
            </span>
            <Switch on={autoAdvance.on} onChange={autoAdvance.onChange} label="Auto-advance" />
          </div>
        </section>
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
