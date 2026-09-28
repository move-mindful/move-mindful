// Workout types shared by the admin server code and the builder. No server-only
// imports. The sequence model and estimate live in @move-mindful/core.

import type { EstimateExercise, WorkoutBlock } from "@move-mindful/core";
import type { ExerciseKind, ExerciseVideo } from "@/lib/exercises/shared";

export type WorkoutLevel = "beginner" | "intermediate" | "advanced";

export const LEVELS: Array<{ id: WorkoutLevel; label: string }> = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

/** An exercise as the builder sees it: enough to search, show, preview and estimate. */
export interface CatalogExercise {
  id: string;
  kind: ExerciseKind;
  name: string;
  sided: boolean;
  timedOnly: boolean;
  archived: boolean;
  /** Every clip it needs is uploaded and processed. */
  playable: boolean;
  /** For the list thumbnail: the live loop (or warm-up video). */
  thumbPlaybackId: string | null;
  /** Warm-ups: the video's length. */
  durationSeconds: number | null;
  equipment: string[];
  dumbbellLevels: string[];
  estimate: EstimateExercise;
  /** For the preview panel. */
  videos: ExerciseVideo[];
}

export interface AdminWorkout {
  id: string;
  title: string;
  description: string;
  level: WorkoutLevel | null;
  instructorId: string | null;
  warmupExerciseId: string | null;
  publishedAt: string | null;
  blocks: WorkoutBlock[];
}

/** What the builder sends to `saveWorkout`. */
export interface WorkoutInput {
  /** Omit to create. */
  id?: string;
  title: string;
  description: string;
  level: WorkoutLevel | null;
  instructorId: string | null;
  warmupExerciseId: string | null;
  blocks: WorkoutBlock[];
}

export interface WorkoutListRow {
  id: string;
  title: string;
  level: WorkoutLevel | null;
  publishedAt: string | null;
  updatedAt: string;
  exerciseCount: number;
  totalSeconds: number;
  hasWarmup: boolean;
}

/** Why a workout can't be published yet (empty when it can). */
export function publishProblems(
  blocks: WorkoutBlock[],
  catalog: Map<string, Pick<CatalogExercise, "name" | "playable">>,
  warmupExerciseId: string | null,
): string[] {
  const problems: string[] = [];
  if (!blocks.some((b) => b.kind !== "rest")) problems.push("Add at least one exercise.");
  if (blocks.some((b) => b.kind === "group" && b.moves.length < 2)) {
    problems.push("Every superset or circuit needs at least two exercises.");
  }
  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.kind === "exercise") ids.add(b.move.exerciseId);
    if (b.kind === "group") b.moves.forEach((m) => ids.add(m.exerciseId));
  }
  if (warmupExerciseId) ids.add(warmupExerciseId);
  const notReady = [...ids].filter((id) => !catalog.get(id)?.playable).map((id) => catalog.get(id)?.name ?? "An exercise");
  if (notReady.length) problems.push(`Still missing clips: ${notReady.join(", ")}.`);
  return problems;
}
