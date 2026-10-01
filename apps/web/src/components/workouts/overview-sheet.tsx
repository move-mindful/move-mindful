"use client";

import type { WorkoutStep } from "@move-mindful/core";
import type { PlayerWorkout } from "@/lib/workouts/player";
import { Drawer, Sheet, SheetClose, type SheetPull } from "./player-screens";
import { WorkoutRows, type RowsPosition } from "./workout-rows";

/**
 * The workout overview: where you are, how long is left, and every exercise
 * with its status. Tapping one jumps there. Opened from "Up next" or by
 * swiping up; the workout waits while it's open.
 *
 * On phones it's a `drawer` — always mounted below the screen, following the
 * finger up — so pass `drawer` and render it the whole workout; on desktop it's
 * a side panel, rendered only while open.
 */
export function OverviewSheet({
  workout,
  steps,
  subtitle,
  progress,
  position,
  onJump,
  onClose,
  drawer,
}: {
  workout: PlayerWorkout;
  steps: WorkoutStep[];
  subtitle: string;
  progress: { label: string; left: string; fraction: number };
  position: RowsPosition;
  /** Tapping an exercise jumps there; none during the cool-down. */
  onJump?: (step: number) => void;
  onClose: () => void;
  /** Phones: open or parked, the pull it follows, and what to do once a pull opens it. */
  drawer?: { open: boolean; pull: SheetPull; onOpen: () => void };
}) {
  const side = !drawer;
  const content = (
    <>
      <div className={`flex flex-col gap-3.5 ${side ? "px-7" : "px-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className={`${side ? "text-[26px]" : "text-2xl"} font-semibold tracking-[-0.01em]`}>{workout.title}</h2>
            <div className="text-sm text-white/70">{subtitle}</div>
          </div>
          <SheetClose label="Close overview and resume" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between gap-3 text-sm font-medium">
            <span className="truncate">{progress.label}</span>
            <span className="shrink-0 text-white/70">{progress.left}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.14]">
            <div className="h-1.5 rounded-full bg-[#A99CFF]" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
          </div>
        </div>
      </div>
      <div data-sheet-scroll className={`min-h-0 overflow-y-auto overscroll-contain ${side ? "px-4" : "px-3"}`}>
        <WorkoutRows workout={workout} steps={steps} position={position} onJump={onJump} />
      </div>
    </>
  );
  return drawer ? (
    <Drawer label="Workout overview" open={drawer.open} pull={drawer.pull} onOpen={drawer.onOpen} onClose={onClose}>
      {content}
    </Drawer>
  ) : (
    <Sheet label="Workout overview" onClose={onClose} variant="side">
      {content}
    </Sheet>
  );
}
