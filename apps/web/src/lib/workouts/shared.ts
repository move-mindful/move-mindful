// Workout types shared by the admin server code and the builder. No server-only
// imports. The sequence model and estimate live in @move-mindful/core.

import type { EstimateExercise, WorkoutBlock } from "@move-mindful/core";
import type { ExerciseKind, ExerciseVideo } from "@/lib/exercises/shared";

// ── Audio tips ────────────────────────────────────────
// The instructor's recordings for a workout's sets and rests (019_workout_audio_tips.sql):
// files in the public `workout-tips` bucket, named "<workout id>/<uuid>.m4a" —
// that path is the tip's id in the sequence (AudioTip in core).

export const TIP_BUCKET = "workout-tips";

/** The longest recording the builder takes. A tip still stops when its set or rest ends. */
export const TIP_MAX_SECONDS = 60;

/** How far into its set (once the exercise starts, after Get ready) or rest a tip begins. */
export const TIP_DELAY_SECONDS = { set: 3, rest: 1 } as const;

/** How loud tips play, 0–1 of the recording's own level (was full; turned down 10% on 2026-10-02). */
export const TIP_VOLUME = 0.9;

/** Where a tip's file is served from. */
export function tipUrl(id: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${TIP_BUCKET}/${id}`;
}

/** A workout's own videos (workout_videos): the intro before it, the outro after it. */
export type WorkoutVideoRole = "intro" | "outro";

/** An intro or outro clip — the same lifecycle as an exercise clip (see slotFor). */
export type WorkoutVideo = Omit<ExerciseVideo, "role" | "repsInClip"> & { role: WorkoutVideoRole };

export type WorkoutLevel = "all_levels" | "beginner" | "intermediate" | "advanced";

/** A workout's level, in the order the builder lists them. "All levels" needs 020_workout_level_all.sql. */
export const LEVELS: Array<{ id: WorkoutLevel; label: string }> = [
  { id: "all_levels", label: "All levels" },
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
  /** For the list thumbnail: the live loop (or warm-up or cool-down video). */
  thumbPlaybackId: string | null;
  /** Warm-ups and cool-downs: the video's length. */
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
  /** Offered after the last exercise ("Cool down?"); a library item of kind "cooldown". */
  cooldownExerciseId: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  blocks: WorkoutBlock[];
  /** Its intro and outro clips, every row (see slotFor). */
  videos: WorkoutVideo[];
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
  cooldownExerciseId: string | null;
  blocks: WorkoutBlock[];
}

/** A workout's member ratings (017_workout_ratings.sql): the average, how many, and how many of each (index 0 = 1 star). */
export interface RatingSummary {
  average: number;
  count: number;
  byStars: [number, number, number, number, number];
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
  hasCooldown: boolean;
  coverImageUrl: string | null;
  /** Null until a member rates it. */
  rating: RatingSummary | null;
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
  cooldownExerciseId: string | null = null,
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
  if (cooldownExerciseId) ids.add(cooldownExerciseId);
  const notReady = [...ids].filter((id) => !catalog.get(id)?.playable).map((id) => catalog.get(id)?.name ?? "An exercise");
  if (notReady.length) problems.push(`Still missing clips: ${notReady.join(", ")}.`);
  return problems;
}
