"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { clock } from "@/lib/workouts/player";
import { ArrowRight, ChevronLeft, ChevronRight, Dumbbell, Loop, Sun } from "./icons";
import { BeginButton, Chip, type TutorialProgress } from "./player-screens";

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

/** Right of the video: a column of labelled round buttons. */
export function TheaterButtons({ buttons }: { buttons: TheaterButton[] }) {
  return (
    <div className="absolute bottom-16 flex flex-col items-center gap-4" style={{ left: beside }}>
      {buttons.map((b) => (
        <button key={b.label} type="button" aria-label={b.aria} onClick={b.onClick} className="group flex flex-col items-center gap-1.5">
          <span className="flex size-[52px] items-center justify-center rounded-full bg-white/10 transition group-hover:bg-white/20">
            {b.icon}
          </span>
          <span className="text-xs font-medium text-white/70">{b.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Back and next, level with the middle of the video. */
export function TheaterArrows({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  const arrow =
    "absolute top-1/2 -mt-[26px] flex size-[52px] items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20";
  return (
    <>
      <button type="button" aria-label="Previous set" onClick={onBack} className={arrow} style={{ right: beside }}>
        <ChevronLeft />
      </button>
      <button type="button" aria-label={nextLabel} onClick={onNext} className={arrow} style={{ left: beside }}>
        <ChevronRight />
      </button>
    </>
  );
}

export function TheaterSetInfo({
  name,
  metric,
  side,
  groupLine,
  upNext,
}: {
  name: string;
  metric: { kind: "reps"; amount: number } | { kind: "time"; seconds: number };
  side: "right" | "left" | null;
  groupLine: string | null;
  upNext: string;
}) {
  return (
    <Info gap={4}>
      {groupLine && (
        <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold tracking-[0.02em] text-[#A99CFF]">
          <Loop size={15} />
          {groupLine}
        </div>
      )}
      <div className="flex items-center gap-3.5">
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
          <span className="flex h-8 items-center rounded-full bg-[#A99CFF] px-3.5 text-sm font-bold tracking-[0.08em] text-[#14142B]">
            {side.toUpperCase()}
          </span>
        )}
      </div>
      <h1 className="text-[28px] font-semibold leading-tight">{name}</h1>
      <div className="mt-3 text-[15px] text-white/65">Up next · {upNext}</div>
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
      <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.015em]">{name}</h1>
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

export function TheaterWarmupInfo({ name, onSkip }: { name: string; onSkip: () => void }) {
  return (
    <Info gap={14}>
      <span className="flex h-[30px] items-center gap-[7px] rounded-full bg-white/[0.14] pl-2.5 pr-[13px] text-[13px] font-bold uppercase tracking-[0.08em]">
        <Sun size={15} />
        Warm-up
      </span>
      <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.015em]">{name}</h1>
      <button
        type="button"
        onClick={onSkip}
        className="mt-2.5 flex h-14 w-60 items-center justify-center gap-2.5 rounded-full border-[1.5px] border-white/55 bg-white/[0.08] text-[17px] font-semibold"
      >
        Skip warm-up
        <ArrowRight />
      </button>
    </Info>
  );
}
