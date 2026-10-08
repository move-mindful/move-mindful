"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { aboutMinutes, estimateWorkout, workoutSteps, type EstimateExercise, type WorkoutBlock } from "@move-mindful/core";
import { mp4Url, slotFor, type VideoRole } from "@/lib/exercises/shared";
import { exerciseLineup, type PlayerClip, type PlayerExercise, type PlayerWorkout } from "@/lib/workouts/player";
import type { CatalogExercise } from "@/lib/workouts/shared";
import { outfit } from "@/components/workouts/outfit";
import { Dim, RundownScreen } from "@/components/workouts/player-screens";

// The workout overview as members get it — the player's own RundownScreen —
// in a phone-sized frame over the builder, for its tip: recording it (tap
// each exercise as you start talking about it) or playing it back (the
// highlight following those taps). The frame is a phone's width, and at
// least a phone's height, growing to show the whole workout without
// scrolling — up to the window's height, when the list scrolls.

/** A phone's height (an iPhone's 390 × 844), as tall as fits. */
const PHONE = "min(780px, 100dvh - 80px)";
const frame: CSSProperties = {
  width: `calc(${PHONE} * 390 / 844)`,
  minHeight: PHONE,
  maxHeight: "calc(100dvh - 80px)",
};

function clipOf(e: CatalogExercise, role: VideoRole): PlayerClip | undefined {
  const video = slotFor(e.videos, role).current;
  const url = video && mp4Url(video);
  if (!video?.playbackId || !url) return undefined;
  return {
    url,
    poster: `https://image.mux.com/${video.playbackId}/thumbnail.webp?width=720&time=0`,
    durationSeconds: video.durationSeconds,
  };
}

/** The workout as the member player sees it, from the builder's sequence and catalog — as much as the overview needs. */
function previewWorkout(blocks: WorkoutBlock[], byId: Map<string, CatalogExercise>): PlayerWorkout {
  const exercises: Record<string, PlayerExercise> = {};
  for (const b of blocks) {
    const moves = b.kind === "exercise" ? [b.move] : b.kind === "group" ? b.moves : [];
    for (const m of moves) {
      const e = byId.get(m.exerciseId);
      if (!e || exercises[e.id]) continue;
      exercises[e.id] = {
        id: e.id,
        name: e.name,
        sided: e.sided,
        dumbbellLevels: e.dumbbellLevels,
        tutorial: null,
        loops: e.sided ? { right: clipOf(e, "loop_right"), left: clipOf(e, "loop_left") } : { main: clipOf(e, "loop") },
        thumbnail: null,
        estimate: e.estimate,
      };
    }
  }
  return {
    id: "",
    title: "",
    instructor: null,
    description: "",
    level: null,
    coverImageUrl: null,
    published: false,
    intro: null,
    warmup: null,
    cooldown: null,
    outro: null,
    rundownTip: null,
    exercises,
    blocks,
    equipment: [],
    dumbbellLevels: [],
  };
}

export function OverviewPreview({
  blocks,
  byId,
  estimates,
  exerciseId,
  onPick,
  caption,
  controls,
}: {
  blocks: WorkoutBlock[];
  byId: Map<string, CatalogExercise>;
  estimates: Record<string, EstimateExercise>;
  /** The exercise lit, its loop playing. */
  exerciseId: string | null;
  /** Recording: tapping an exercise cues it (with the tap's time, the event's timeStamp). */
  onPick?: (exerciseId: string, at: number) => void;
  /** A line above the phone: what to do. */
  caption: string;
  /** In place of the member's Pause / Continue. */
  controls: ReactNode;
}) {
  const workout = useMemo(() => previewWorkout(blocks, byId), [blocks, byId]);
  const steps = useMemo(() => workoutSteps(blocks, estimates), [blocks, estimates]);
  const minutes = aboutMinutes(estimateWorkout(blocks, estimates).totalSeconds);
  const lineup = useMemo(() => exerciseLineup(steps, workout.exercises), [steps, workout.exercises]);
  const clip = (lineup.find((x) => x.exerciseId === exerciseId) ?? lineup[0])?.clip;
  const noop = () => {};
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workout overview"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-zinc-950/75 p-4"
    >
      <p className="max-w-sm text-center text-sm font-medium text-white">{caption}</p>
      <div
        className={`${outfit.className} relative flex flex-col overflow-hidden rounded-[36px] bg-[#14142B] text-white shadow-2xl`}
        style={frame}
      >
        {/* A new element per exercise: a cut, as in the player. */}
        {clip && (
          <video
            key={clip.url}
            src={clip.url}
            poster={clip.poster}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <Dim strength={0.4} />
        <RundownScreen
          workout={workout}
          steps={steps}
          minutes={minutes}
          exerciseId={exerciseId}
          onPick={onPick}
          fraction={0}
          paused={false}
          onPause={noop}
          onResume={noop}
          onContinue={noop}
          controls={controls}
          fit
        />
      </div>
    </div>
  );
}
