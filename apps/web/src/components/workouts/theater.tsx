"use client";

import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { clock } from "@/lib/workouts/player";
import { ArrowRight, ChevronLeft, ChevronRight, Dumbbell, Loop } from "./icons";
import { BeginButton, Chip, LabelLine, ProgressFill, type TutorialProgress } from "./player-screens";

// The player's desktop ("theater") layout, from the desktop frames of the
// player design canvas: the 9:16 video in the middle, what's on to its left,
// right-aligned against it, and a column of labelled buttons to its right.
// Everything is placed relative to the video column's width, `--col`, which
// workout-player.tsx sets on the stage.

/** Keep in step with the `theater` variant in app/globals.css. */
export const THEATER_QUERY = "(min-width: 1024px) and (min-aspect-ratio: 5/4)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(THEATER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the screen is wide enough for the theater layout. */
export function useTheater(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(THEATER_QUERY).matches,
    () => false,
  );
}

/** 32px out from the video's edge, on either side. */
const beside = "calc(50% + var(--col) / 2 + 32px)";

/** Left of the video: what's on, right-aligned against it. */
function Info({ gap, children }: { gap: number; children: ReactNode }) {
  return (
    <div
      className="absolute bottom-16 flex flex-col items-end text-right"
      style={{ right: beside, width: "min(360px, calc(50% - var(--col) / 2 - 64px))", gap }}
    >
      {children}
    </div>
  );
}

export interface TheaterButton {
  label: string;
  aria: string;
  icon: ReactNode;
  onClick: () => void;
}


/**
 * Paused: what's on (the info left of the video) stays in place, dimmed and
 * out of reach — the pause screen has the controls. The wrapper covers the
 * whole stage, so the info's own positions don't move.
 */
export function Dimmed({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60">
      {children}
    </div>
  );
}

/**
 * Back and next, level with the middle of the video, and right of the video a
 * column of labelled round buttons. Next heads that column, so on a short
 * window (a small laptop, a tablet) it rises to stay above the buttons rather
 * than ending up under them — and back rises with it, so the two always sit
 * level.
 */
export function TheaterControls({
  onBack,
  onNext,
  nextLabel,
  backLabel = "Previous set",
  buttons,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  backLabel?: string;
  buttons: TheaterButton[];
}) {
  const arrow = "flex size-[52px] shrink-0 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20";
  const column = (side: CSSProperties, head: ReactNode, under: ReactNode) => (
    // The column runs from the top to 64px off the bottom, packed at its foot:
    // the arrow, then the buttons. The buttons' box is at least half the
    // column less 58px tall, which puts the arrow's middle level with the
    // video's; when the buttons need more room than that, the arrow sits 32px
    // above them instead.
    <div
      className="pointer-events-none absolute top-0 bottom-16 flex flex-col items-center justify-end [&_button]:pointer-events-auto"
      style={side}
    >
      {head}
      {under}
    </div>
  );
  const stack = (hidden: boolean) => (
    <div
      aria-hidden={hidden || undefined}
      className={`flex flex-col items-center justify-end gap-4 pt-8 ${hidden ? "invisible" : ""}`}
      style={{ minHeight: "calc(50% - 58px)" }}
    >
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          aria-label={b.aria}
          onClick={b.onClick}
          tabIndex={hidden ? -1 : undefined}
          className="group flex flex-col items-center gap-1.5"
        >
          <span className="flex size-[52px] items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20">
            {b.icon}
          </span>
          <span className="text-xs font-medium text-white/70">{b.label}</span>
        </button>
      ))}
    </div>
  );
  return (
    <>
      {/* Left, back sits on an invisible copy of the buttons: the same
          column, so it's always at next's height. */}
      {column(
        { right: beside },
        <button type="button" aria-label={backLabel} onClick={onBack} className={arrow}>
          <ChevronLeft />
        </button>,
        stack(true),
      )}
      {column(
        { left: beside },
        <button type="button" aria-label={nextLabel} onClick={onNext} className={arrow}>
          <ChevronRight />
        </button>,
        stack(false),
      )}
    </>
  );
}

export function TheaterSetInfo({
  name,
  metric,
  side,
  groupLine,
  upNext,
  fill = null,
}: {
  name: string;
  metric: { kind: "reps"; amount: number } | { kind: "time"; seconds: number };
  side: "right" | "left" | null;
  groupLine: string | null;
  upNext: string;
  /** How far until the set moves on by itself (auto-advance, a timed set): UP NEXT fills with it. */
  fill?: number | null;
}) {
  return (
    <Info gap={4}>
      {groupLine && (
        <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold tracking-[0.02em] text-[#A99CFF]">
          <Loop size={15} />
          {groupLine}
        </div>
      )}
      {/* On the reps' baseline; the side pill is centred on "reps", as on phones. */}
      <div className="flex items-baseline gap-3.5">
        {metric.kind === "reps" ? (
          <span className="flex items-baseline gap-2.5">
            <span className="text-[88px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{metric.amount}</span>
            <span className="text-[34px] font-medium">{metric.amount === 1 ? "rep" : "reps"}</span>
          </span>
        ) : (
          <span role="timer" className="text-[88px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {clock(metric.seconds)}
          </span>
        )}
        {side && (
          <span className="text-[34px] font-medium">
            <span className="inline-flex h-8 items-center rounded-full bg-[#A99CFF] px-3.5 align-middle text-sm font-bold tracking-[0.08em] text-white">
              {side.toUpperCase()}
            </span>
          </span>
        )}
      </div>
      <h1 className="text-[28px] font-semibold leading-tight">{name}</h1>
      {/* The same Up next pill as the phone's minimised view. */}
      <LabelLine label="Up next" text={upNext} fill={fill} className="mt-3 max-w-full" />
    </Info>
  );
}

export function TheaterTutorialInfo({
  name,
  chips,
  levels,
  progress,
  onBegin,
}: {
  name: string;
  chips: string[];
  levels: string | null;
  progress: TutorialProgress;
  onBegin: () => void;
}) {
  return (
    <Info gap={14}>
      <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.015em]">
        {name}
      </h1>
      <div className="flex flex-wrap justify-end gap-2">
        {chips.map((c) => (
          <Chip key={c} large>
            {c}
          </Chip>
        ))}
        {levels && (
          <Chip large>
            <Dumbbell size={16} />
            {levels}
          </Chip>
        )}
      </div>
      <BeginButton progress={progress} onBegin={onBegin} className="mt-2.5 w-[300px]" />
    </Info>
  );
}

export function TheaterVideoInfo({
  chip,
  name,
  fraction,
  skipLabel,
  onSkip,
}: {
  /** "Warm-up" with its sun, "Cool-down" with its moon, "Intro", "Outro". */
  chip: { label: string; icon: ReactNode };
  name: string;
  /** How far through the video it is — Skip fills with it. */
  fraction: number;
  /** "Skip warm-up", "Skip intro"… */
  skipLabel: string;
  onSkip: () => void;
}) {
  return (
    <Info gap={14}>
      <span className="flex h-[30px] items-center gap-[7px] rounded-full bg-white/[0.14] pl-2.5 pr-[13px] text-[13px] font-bold uppercase tracking-[0.08em]">
        {chip.icon}
        {chip.label}
      </span>
      <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.015em]">{name}</h1>
      <button
        type="button"
        onClick={onSkip}
        className="relative mt-2.5 flex h-14 w-60 items-center justify-center gap-2.5 overflow-hidden rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-[17px] font-semibold"
      >
        <ProgressFill fraction={fraction} />
        <span className="relative">{skipLabel}</span>
        <span className="relative">
          <ArrowRight />
        </span>
      </button>
    </Info>
  );
}
