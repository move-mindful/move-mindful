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
  /** 1 to 4, higher is more intense; null when not set. */
  intensity: number | null;
  /** Exercises it pairs well with in a superset or circuit. */
  pairIds: string[];
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
  coverImageUrl: string | null;
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
  coverImageUrl: string | null;
}

// ── Generate with AI ──────────────────────────────────
// The builder's "Generate with AI" window. Every field is optional: whatever
// is left blank is Claude's call. See lib/workouts/generate.ts.

export type GenerateStyle = "straight" | "supersets" | "circuit" | "mix";

export const GENERATE_STYLES: Array<{ id: GenerateStyle; label: string }> = [
  { id: "straight", label: "Straight sets" },
  { id: "supersets", label: "Supersets" },
  { id: "circuit", label: "Circuit" },
  { id: "mix", label: "Mix" },
];

/** "Bodyweight only" in the equipment choices — no equipment at all. */
export const BODYWEIGHT_ONLY = "none";

export interface GenerateCriteria {
  /** Target length in minutes, as the builder estimates it. */
  minutes: number | null;
  level: WorkoutLevel | null;
  /** Exercise tag ids to focus on. */
  focusTagIds: string[];
  /** Equipment on hand (EQUIPMENT_OPTIONS ids), or [BODYWEIGHT_ONLY]. */
  equipment: string[];
  /** Dumbbell weights on hand, when dumbbells are. */
  dumbbellLevels: string[];
  style: GenerateStyle | null;
  /** "auto" = Claude's call, "none" = no warm-up, otherwise a warm-up's id. */
  warmup: string;
  /** Anything else, in the admin's words. */
  prompt: string;
}

export const EMPTY_CRITERIA: GenerateCriteria = {
  minutes: null,
  level: null,
  focusTagIds: [],
  equipment: [],
  dumbbellLevels: [],
  style: null,
  warmup: "auto",
  prompt: "",
};

export interface GeneratedWorkout {
  title: string;
  description: string;
  level: WorkoutLevel;
  warmupExerciseId: string | null;
  blocks: WorkoutBlock[];
  /** A word to the admin about the thinking behind it. Never shown to members. */
  notes: string;
}

export type GenerateResult = { workout: GeneratedWorkout; error?: never } | { workout?: never; error: string };

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
