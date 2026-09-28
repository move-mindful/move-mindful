"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
        style={{ background: "linear-gradient(180deg, rgba(14,14,32,0.72) 0%, rgba(14,14,32,0.38) 55%, rgba(14,14,32,0) 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: bottom,
          background:
            "linear-gradient(0deg, rgba(14,14,32,0.95) 0%, rgba(14,14,32,0.84) 42%, rgba(14,14,32,0.4) 72%, rgba(14,14,32,0) 100%)",
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

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-white/[0.14] px-3 text-sm font-medium">{children}</span>
  );
}

// ── Tap zones ─────────────────────────────────────────

/**
 * Stories-style gestures over the video: tap the left third to go back, the
 * rest to move on, press and hold anywhere to pause, swipe up for the
 * overview. Buttons sit above this layer, so they never count as a tap here.
 */
export function TapZones({
  onBack,
  onNext,
  onHold,
  onSwipeUp,
  nextLabel = "Next",
}: {
  onBack: () => void;
  onNext: () => void;
  onHold: () => void;
  onSwipeUp: () => void;
  nextLabel?: string;
}) {
  const press = useRef<{ x: number; y: number; left: boolean; done: boolean; timer: number } | null>(null);
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
          const p = {
            x: e.clientX,
            y: e.clientY,
            left: e.clientX - box.left < box.width / 3,
            done: false,
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
          if (!p || p.done) return;
          const dx = e.clientX - p.x;
          const dy = e.clientY - p.y;
          if (dy < -60 && Math.abs(dx) < 80) {
            p.done = true;
            window.clearTimeout(p.timer);
            onSwipeUp();
          } else if (Math.hypot(dx, dy) > 16) {
            window.clearTimeout(p.timer);
          }
        }}
        onPointerUp={(e) => {
          const p = press.current;
          end();
          if (!p || p.done || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 24) return;
          if (p.left) onBack();
          else onNext();
        }}
        onPointerCancel={end}
      />
      {/* The same moves for keyboards and screen readers. */}
      <button type="button" className="sr-only" onClick={onBack}>
        Previous set
      </button>
      <button type="button" className="sr-only" onClick={onNext}>
        {nextLabel}
      </button>
    </>
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
  onPause: () => void;
  onOverview: () => void;
  onMute: () => void;
  onTutorialSettings: (() => void) | null;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col gap-[18px] px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
      <div className="flex flex-col gap-0.5">
        {groupLine && (
          <div className="mb-1.5 flex items-center gap-[7px] text-[13px] font-semibold tracking-[0.02em] text-[#A99CFF]">
            <Loop size={14} />
            {groupLine}
          </div>
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-xl font-semibold leading-tight">{name}</h1>
          {onTutorialSettings && (
            <RoundButton label="Tutorial settings" onClick={onTutorialSettings}>
              <Tutorial />
            </RoundButton>
          )}
        </div>
      </div>
      <ControlsRow pill={pill} muted={muted} onPause={onPause} onOverview={onOverview} onMute={onMute} />
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
  onBegin: () => void;
  onPause: () => void;
  onOverview: () => void;
  onMute: () => void;
  onTutorialSettings: () => void;
}) {
  return (
    <div className={`absolute inset-x-0 bottom-0 flex flex-col gap-[18px] px-5 pointer-events-none [&_button]:pointer-events-auto ${bottomPad}`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]">{name}</h1>
          <RoundButton label="Tutorial settings" onClick={onTutorialSettings}>
            <Tutorial />
          </RoundButton>
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {levels && (
            <Chip>
              <Dumbbell size={16} />
              {levels}
            </Chip>
          )}
        </div>
      </div>
      {once ? (
        <button
          type="button"
          onClick={onBegin}
          aria-label={`Skip tutorial. The exercise starts on its own in ${Math.ceil(once.secondsLeft)} seconds`}
          className="relative flex h-[58px] items-center justify-center gap-2.5 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-[17px] font-semibold"
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
          className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
        >
          Begin
          <ArrowRight />
        </button>
      )}
      <ControlsRow pill={pill} muted={muted} onPause={onPause} onOverview={onOverview} onMute={onMute} />
    </div>
  );
}

// ── Rest ──────────────────────────────────────────────

const RING = 2 * Math.PI * 116;

export function RestScreen({
  round,
  secondsLeft,
  totalSeconds,
  roundLine,
  next,
  onPause,
  onContinue,
}: {
  /** A group's rest between rounds, rather than an ordinary rest. */
  round: boolean;
  secondsLeft: number;
  totalSeconds: number;
  roundLine: string | null;
  next: { label: string; name: string; detail: string; thumbnail: string | null } | null;
  onPause: () => void;
  onContinue: () => void;
}) {
  const shown = Math.ceil(secondsLeft);
  return (
    <div className="pointer-events-none [&_button]:pointer-events-auto absolute inset-0 flex flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] pt-12">
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
              strokeDashoffset={RING * (1 - (totalSeconds > 0 ? secondsLeft / totalSeconds : 0))}
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
      <div className={`relative flex flex-col gap-4 px-5 ${bottomPad}`}>
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
}: {
  subtitle: string;
  stats: { elapsed: string; setsDone: string; left: string } | null;
  onResume: () => void;
  onRestartSet: (() => void) | null;
  onRestartWorkout: (() => void) | null;
  onWatchTutorial: (() => void) | null;
  onSkipWarmup: (() => void) | null;
  onEnd: () => void;
}) {
  const secondary =
    "flex h-[54px] shrink-0 items-center justify-center gap-2.5 rounded-full bg-white/[0.12] text-base font-semibold";
  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-6 pt-16">
        <button
          type="button"
          aria-label="Resume workout"
          onClick={onResume}
          autoFocus
          className="flex size-[104px] items-center justify-center rounded-full bg-white text-[#14142B] shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
        >
          <Play />
        </button>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-[30px] font-semibold tracking-[-0.01em]">Paused</h1>
          <div className="text-base text-white/75">{subtitle}</div>
        </div>
      </div>
      <div className={`flex flex-col gap-3.5 px-5 ${bottomPad}`}>
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
}: {
  title: string;
  time: string;
  exercises: number;
  sets: number;
  onDone: () => void;
  onRestart: () => void;
}) {
  return (
    <div className={`absolute inset-0 flex flex-col gap-6 overflow-y-auto px-5 pt-[72px] ${bottomPad}`}>
      <div className="flex flex-1 flex-col items-center justify-center gap-7">
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
      <div className="flex flex-col gap-3">
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

/** A bottom sheet over the paused stage. Tapping the dimmed area closes it. */
export function Sheet({
  label,
  onClose,
  children,
  alert = false,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end">
      <div className="absolute inset-0 bg-[#080814]/60" onClick={onClose} aria-hidden="true" />
      <section
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={label}
        className={`relative flex max-h-[88%] flex-col gap-4 rounded-t-[28px] bg-[#1A1A34] pt-2.5 ${bottomPad}`}
      >
        <div className="h-[5px] w-10 shrink-0 self-center rounded-full bg-white/[0.28]" />
        {children}
      </section>
    </div>
  );
}

export function SheetClose({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      autoFocus
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10"
    >
      <Close />
    </button>
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
}: {
  mode: TutorialMode;
  /** The exercise whose tutorial can be watched now, if it has one. */
  watch: { name: string; duration: number | null; thumbnail: string | null } | null;
  onMode: (mode: TutorialMode) => void;
  onWatch: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet label="Tutorial settings" onClose={onClose}>
      <div className="flex min-h-0 flex-col gap-[18px] overflow-y-auto overscroll-contain px-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Tutorials</h2>
          <SheetClose label="Close tutorial settings" onClick={onClose} />
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
  onKeepGoing,
}: {
  setsDone: number;
  setsTotal: number;
  onEnd: () => void;
  onKeepGoing: () => void;
}) {
  return (
    <Sheet label="End workout?" onClose={onKeepGoing} alert>
      <div className="flex flex-col gap-[22px] px-5">
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
          <button
            type="button"
            onClick={onKeepGoing}
            autoFocus
            className="h-12 text-base font-semibold text-white/80"
          >
            Keep going
          </button>
        </div>
      </div>
    </Sheet>
  );
}
