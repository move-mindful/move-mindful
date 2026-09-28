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
  ChevronUp,
  Close,
  Dumbbell,
  Exit,
  Loop,
  Muted,
  Pause,
  Play,
  RestartSet,
  RestartWorkout,
  Sound,
  Sun,
  Tutorial,
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

/** Darken the top and bottom of the video so the white type reads over it. */
export function Shade({ bottom = 350 }: { bottom?: number }) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[110px]"
        style={{ background: "linear-gradient(180deg, rgba(14,14,32,0.58) 0%, rgba(14,14,32,0.3) 55%, rgba(14,14,32,0) 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-300 ease-out"
        style={{
          height: bottom,
          background:
            "linear-gradient(0deg, rgba(14,14,32,0.8) 0%, rgba(14,14,32,0.68) 42%, rgba(14,14,32,0.3) 72%, rgba(14,14,32,0) 100%)",
        }}
      />
    </>
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

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <RoundButton label={muted ? "Turn sound on" : "Mute sound"} onClick={onToggle}>
      {muted ? <Muted /> : <Sound />}
    </RoundButton>
  );
}

/** Pause · Up next (opens the overview) · sound. */
function ControlsRow({
  pill,
  muted,
  onPause,
  onOverview,
  onMute,
}: {
  pill: { label: string; text: string };
  muted: boolean;
  onPause: () => void;
  onOverview: () => void;
  onMute: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <RoundButton label="Pause" onClick={onPause}>
        <Pause />
      </RoundButton>
      <button
        type="button"
        aria-label={`Open workout overview. ${pill.label}: ${pill.text}`}
        onClick={onOverview}
        className="flex h-[52px] min-w-0 items-center gap-2.5 rounded-full border border-white/20 bg-white/10 pl-3.5 pr-5 text-left backdrop-blur-md"
      >
        <ChevronUp />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">{pill.label}</span>
          <span className="truncate text-[15px] font-medium">{pill.text}</span>
        </span>
      </button>
      <MuteButton muted={muted} onToggle={onMute} />
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
 * An overview being pulled up by the finger, passed from the tap zones (via
 * the player) to the sheet. The sheet only mounts after the pull has started,
 * so it catches up with the distance so far — and a quick flick can end before
 * it mounts at all, in which case the outcome waits for it.
 */
export function createSheetPull() {
  type Follower = { move: (distance: number) => void; end: (distance: number, velocity: number) => void };
  let active = false;
  let distance = 0;
  let pending: { distance: number; velocity: number } | null = null;
  let follower: Follower | null = null;
  return {
    get active() {
      return active;
    },
    start() {
      active = true;
      distance = 0;
      pending = null;
    },
    move(d: number) {
      distance = d;
      follower?.move(d);
    },
    end(d: number, velocity: number) {
      active = false;
      if (follower) follower.end(d, velocity);
      else pending = { distance: d, velocity };
    },
    /** For the sheet: follow the pull, if there is one. Returns a detach function, or null. */
    follow(f: Follower): (() => void) | null {
      if (pending) {
        const done = pending;
        pending = null;
        f.move(done.distance);
        const frame = requestAnimationFrame(() => f.end(done.distance, done.velocity));
        return () => cancelAnimationFrame(frame);
      }
      if (!active) return null;
      follower = f;
      f.move(distance);
      return () => {
        if (follower === f) follower = null;
      };
    },
  };
}

export type SheetPull = ReturnType<typeof createSheetPull>;

/**
 * Gestures over the video, in three zones: tap the left third to go back, the
 * middle to pause, the right third to move on. Press and hold anywhere also
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
}: {
  onBack: () => void;
  onNext: () => void;
  onMiddle: () => void;
  onHold: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  /** Dragging up pulls the overview (instead of a swipe up calling `onSwipeUp`). */
  pullUp: boolean;
  onPullMove: (distance: number) => void;
  /** `velocity` is upward, in px per ms. */
  onPullEnd: (distance: number, velocity: number) => void;
  nextLabel?: string;
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
          const box = e.currentTarget.getBoundingClientRect();
          const third = (e.clientX - box.left) / (box.width / 3);
          const p = {
            x: e.clientX,
            y: e.clientY,
            zone: (third < 1 ? 0 : third < 2 ? 1 : 2) as 0 | 1 | 2,
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
            onPullMove(Math.max(0, -dy));
            return;
          }
          if (p.done) return;
          if (pullUp && dy < -10 && Math.abs(dy) > Math.abs(dx)) {
            p.pulling = true;
            window.clearTimeout(p.timer);
            onPullMove(-dy);
          } else if (Math.abs(dy) > 60 && Math.abs(dx) < 80) {
            p.done = true;
            window.clearTimeout(p.timer);
            if (dy < 0) onSwipeUp();
            else onSwipeDown();
          } else if (Math.hypot(dx, dy) > 16) {
            window.clearTimeout(p.timer);
          }
        }}
        onPointerUp={(e) => {
          const p = press.current;
          end();
          if (!p) return;
          if (p.pulling) {
            onPullEnd(Math.max(0, p.y - e.clientY), p.velocity);
            return;
          }
          if (p.done || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 24) return;
          [onBack, onMiddle, onNext][p.zone]();
        }}
        onPointerCancel={() => {
          const p = press.current;
          end();
          if (p?.pulling) onPullEnd(0, 0);
        }}
      />
      {/* Back and next for keyboards and screen readers (Pause is a real button). */}
      <button type="button" className="sr-only" onClick={onBack}>
        Previous set
      </button>
      <button type="button" className="sr-only" onClick={onNext}>
        {nextLabel}
      </button>
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

// ── The exercise ──────────────────────────────────────

export function SetScreen({
  name,
  metric,
  side,
  groupLine,
  pill,
  muted,
  hidden,
  onPause,
  onOverview,
  onMute,
  onTutorialSettings,
}: {
  name: string;
  /** Reps to do, or the seconds left on a timed set. */
  metric: { kind: "reps"; amount: number } | { kind: "time"; seconds: number };
  side: "right" | "left" | null;
  /** "Superset 1 · Round 2 of 3" inside a group. */
  groupLine: string | null;
  pill: { label: string; text: string };
  muted: boolean;
  /** Controls swiped away: just the reps (or time) left over the video. */
  hidden: boolean;
  onPause: () => void;
  onOverview: () => void;
  onMute: () => void;
  onTutorialSettings: (() => void) | null;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
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
      <Collapse open={!hidden}>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-xl font-semibold leading-tight">{name}</h1>
          {onTutorialSettings && (
            <RoundButton label="Tutorial settings" onClick={onTutorialSettings}>
              <Tutorial />
            </RoundButton>
          )}
        </div>
        <div className="mt-[18px]">
          <ControlsRow pill={pill} muted={muted} onPause={onPause} onOverview={onOverview} onMute={onMute} />
        </div>
      </Collapse>
    </div>
  );
}

export function TutorialScreen({
  name,
  chips,
  levels,
  once,
  pill,
  muted,
  hidden,
  onBegin,
  onPause,
  onOverview,
  onMute,
  onTutorialSettings,
}: {
  name: string;
  chips: string[];
  levels: string | null;
  /** Playing once: how far through it is, and the seconds left before the exercise starts. */
  once: { fraction: number; secondsLeft: number } | null;
  pill: { label: string; text: string };
  muted: boolean;
  /** Controls swiped away: just the sets and reps left over the video. */
  hidden: boolean;
  onBegin: () => void;
  onPause: () => void;
  onOverview: () => void;
  onMute: () => void;
  onTutorialSettings: () => void;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
      <Collapse open={!hidden}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]">{name}</h1>
          <RoundButton label="Tutorial settings" onClick={onTutorialSettings}>
            <Tutorial />
          </RoundButton>
        </div>
      </Collapse>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        {levels && !hidden && (
          <Chip>
            <Dumbbell size={16} />
            {levels}
          </Chip>
        )}
      </div>
      <Collapse open={!hidden}>
        <div className="mt-[18px] flex flex-col gap-[18px]">
          <BeginButton once={once} onBegin={onBegin} />
          <ControlsRow pill={pill} muted={muted} onPause={onPause} onOverview={onOverview} onMute={onMute} />
        </div>
      </Collapse>
    </div>
  );
}

/**
 * Starts the exercise from its tutorial: "Begin", or — for a tutorial playing
 * once — "Skip tutorial", filling up as it plays with the time left before it
 * starts on its own.
 */
export function BeginButton({
  once,
  onBegin,
  className = "",
}: {
  once: { fraction: number; secondsLeft: number } | null;
  onBegin: () => void;
  className?: string;
}) {
  return once ? (
    <button
      type="button"
      onClick={onBegin}
      aria-label={`Skip tutorial. The exercise starts on its own in ${Math.ceil(once.secondsLeft)} seconds`}
      className={`relative flex h-[58px] items-center justify-center gap-2.5 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-[17px] font-semibold ${className}`}
    >
      <span
        className="absolute inset-y-0 left-0 bg-white/20"
        style={{ width: `${Math.min(100, once.fraction * 100)}%`, transition: "width 250ms linear" }}
      />
      <span className="relative">Skip tutorial</span>
      <span className="relative">
        <ArrowRight />
      </span>
      <span className="absolute inset-y-0 right-[22px] flex items-center text-[15px] font-medium tabular-nums text-white/80">
        {clock(Math.ceil(once.secondsLeft))}
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={onBegin}
      className={`flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B] ${className}`}
    >
      Begin
      <ArrowRight />
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

export function RestScreen({
  round,
  secondsLeft,
  totalSeconds,
  roundLine,
  next,
  onPause,
  onContinue,
  theater = false,
}: {
  /** A group's rest between rounds, rather than an ordinary rest. */
  round: boolean;
  secondsLeft: number;
  totalSeconds: number;
  roundLine: string | null;
  next: { label: string; name: string; detail: string; thumbnail: string | null } | null;
  onPause: () => void;
  onContinue: () => void;
  theater?: boolean;
}) {
  const shown = Math.ceil(secondsLeft);
  return (
    <div
      className={`pointer-events-none [&_button]:pointer-events-auto ${theater ? centered : "absolute inset-0 flex flex-col"}`}
    >
      <div className={`flex flex-col items-center gap-[18px] ${theater ? "" : "flex-1 justify-center pt-12"}`}>
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#A99CFF]">
          {round && <Loop size={16} />}
          {round ? "Round rest" : "Rest"}
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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPause}
            className="flex h-[58px] flex-1 items-center justify-center gap-2.5 rounded-full bg-white/[0.14] text-[17px] font-semibold"
          >
            <Pause />
            Pause
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="flex h-[58px] flex-[1.4] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
          >
            Continue
            <ArrowRight />
          </button>
        </div>
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
  muted,
  onPause,
  onSkip,
  onMute,
}: {
  name: string;
  seconds: number;
  duration: number;
  muted: boolean;
  onPause: () => void;
  onSkip: () => void;
  onMute: () => void;
}) {
  return (
    <>
      <WarmupProgress seconds={seconds} duration={duration} />
      <div className={`absolute inset-x-0 bottom-0 flex flex-col gap-[18px] px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
        <div className="flex flex-col gap-2">
          <span className="flex h-[26px] items-center gap-1.5 self-start rounded-full bg-white/[0.16] pl-[9px] pr-[11px] text-xs font-bold uppercase tracking-[0.08em]">
            <Sun size={14} />
            Warm-up
          </span>
          <h1 className="text-[22px] font-semibold leading-tight">{name}</h1>
        </div>
        <div className="flex items-center justify-between gap-3">
          <RoundButton label="Pause" onClick={onPause}>
            <Pause />
          </RoundButton>
          <button
            type="button"
            onClick={onSkip}
            className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.22] bg-white/[0.12] text-base font-semibold backdrop-blur-md"
          >
            Skip warm-up
            <ArrowRight size={18} />
          </button>
          <MuteButton muted={muted} onToggle={onMute} />
        </div>
      </div>
    </>
  );
}

// ── Paused ────────────────────────────────────────────

export function PausedScreen({
  subtitle,
  stats,
  onResume,
  onRestartSet,
  onRestartWorkout,
  onWatchTutorial,
  onSkipWarmup,
  onEnd,
  theater = false,
}: {
  subtitle: string;
  stats: { elapsed: string; setsDone: string; left: string } | null;
  onResume: () => void;
  onRestartSet: (() => void) | null;
  onRestartWorkout: (() => void) | null;
  onWatchTutorial: (() => void) | null;
  onSkipWarmup: (() => void) | null;
  onEnd: () => void;
  theater?: boolean;
}) {
  const secondary =
    "flex h-[54px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-white/[0.12] text-base font-semibold";
  return (
    <div className={theater ? centered : "absolute inset-0 flex flex-col overflow-y-auto"}>
      <div className={`flex flex-col items-center gap-5 ${theater ? "" : "flex-1 justify-end pb-8 pt-16"}`}>
        <div className="flex flex-col items-center gap-1 text-center">
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
            Restart this set
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
  pull,
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
  /** Set when the sheet opens under the finger (the overview's pull-up). */
  pull?: SheetPull;
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

  // Slide in: start off-screen, let that frame paint, then transition in. Or,
  // when it's being pulled up, sit under the finger and settle on release.
  useLayoutEffect(() => {
    const el = panelRef.current;
    const backdrop = backdropRef.current;
    if (!el || !backdrop) return;
    const detach = pull?.follow({
      move: (distance) => {
        const h = el.offsetHeight;
        el.style.willChange = "transform";
        el.style.transition = "none";
        backdrop.style.transition = "none";
        el.style.transform = `translateY(${Math.max(0, h - distance)}px)`;
        backdrop.style.opacity = String(Math.min(1, distance / h));
      },
      end: (distance, velocity) => {
        if (distance > 80 || velocity > 0.4) {
          el.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
          el.style.transform = "";
          backdrop.style.transition = "opacity 250ms ease-out";
          backdrop.style.opacity = "";
        } else {
          dismiss();
        }
      },
    });
    if (detach) return detach;
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
  }, [variant, slideIn, pull, dismiss]);


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
  { id: "off", title: "Off", desc: "Go straight to the exercise. Tutorials stay one tap away." },
];

export function TutorialSheet({
  mode,
  watch,
  onMode,
  onWatch,
  onClose,
  variant = "bottom",
}: {
  mode: TutorialMode;
  /** The exercise whose tutorial can be watched now, if it has one. */
  watch: { name: string; duration: number | null; thumbnail: string | null } | null;
  onMode: (mode: TutorialMode) => void;
  onWatch: () => void;
  onClose: () => void;
  variant?: SheetVariant;
}) {
  return (
    <Sheet label="Tutorial settings" onClose={onClose} variant={variant} slideIn={false}>
      <div
        data-sheet-scroll
        className={`flex min-h-0 flex-col gap-[18px] overflow-y-auto overscroll-contain ${variant === "side" ? "px-7" : "px-5"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Tutorials</h2>
          <SheetClose label="Close tutorial settings" />
        </div>
        {watch && (
          <button
            type="button"
            onClick={onWatch}
            className="flex items-center gap-3.5 rounded-[18px] bg-white/[0.07] py-2.5 pl-2.5 pr-3.5 text-left"
          >
            <span className="h-[72px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-white/10">
              {watch.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element -- a tiny Mux still; nothing to optimize
                <img src={watch.thumbnail} alt="" className="size-full object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-[17px] font-semibold">Watch the {watch.name.toLowerCase()} tutorial</span>
              <span className="text-sm text-white/70">
                {watch.duration ? `${clock(watch.duration)} · ` : ""}with audio
              </span>
            </span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#A99CFF] text-[#14142B]">
              <Play size={18} />
            </span>
          </button>
        )}
        <fieldset className="flex min-w-0 flex-col gap-2.5">
          <legend className="mb-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
            Before each new exercise
          </legend>
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 ${
                mode === m.id ? "border-[#A99CFF]/85 bg-[#A99CFF]/[0.14]" : "border-white/[0.12] bg-white/[0.04]"
              }`}
            >
              <input
                type="radio"
                name="tutorial-mode"
                value={m.id}
                checked={mode === m.id}
                onChange={() => onMode(m.id)}
                className="mt-px size-5 shrink-0 accent-[#A99CFF]"
              />
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[17px] font-semibold">{m.title}</span>
                <span className="text-sm leading-snug text-white/75">{m.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </Sheet>
  );
}

export function EndSheet({
  setsDone,
  setsTotal,
  onEnd,
  onCancel,
  variant = "bottom",
}: {
  setsDone: number;
  setsTotal: number;
  onEnd: () => void;
  /** Back to the pause screen. */
  onCancel: () => void;
  variant?: SheetVariant;
}) {
  return (
    <Sheet label="End workout?" onClose={onCancel} alert variant={variant} slideIn={false}>
      <div className={`flex flex-col gap-[22px] ${variant === "dialog" ? "px-7" : "px-5"}`}>
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[26px] font-semibold tracking-[-0.01em]">End workout?</h2>
          <p className="max-w-[300px] text-base leading-[1.45] text-white/75">
            You&rsquo;ve done {setsDone} of {setsTotal} sets.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onEnd}
            className="h-[54px] rounded-full bg-[#FF5A5A]/[0.14] text-base font-semibold text-[#FF9E9E]"
          >
            End workout
          </button>
          <DismissButton autoFocus className="h-12 text-base font-semibold text-white/80">
            Cancel
          </DismissButton>
        </div>
      </div>
    </Sheet>
  );
}
