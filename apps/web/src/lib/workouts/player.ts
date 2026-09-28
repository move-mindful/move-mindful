// The member player's view of a workout: built on the server
// (lib/workouts/member.ts) and handed to the client player. No server-only
// imports. The step model and state machine live in @move-mindful/core.

import type { EstimateExercise, Measure, Side, WorkoutBlock } from "@move-mindful/core";
import { DUMBBELL_LEVELS, EQUIPMENT_OPTIONS } from "@/lib/exercises/shared";
import { LEVELS, type WorkoutLevel } from "@/lib/workouts/shared";

export interface PlayerClip {
  /** The MP4 static rendition. */
  url: string;
  /** The first frame, shown while the clip loads. */
  poster: string;
  durationSeconds: number | null;
}

export interface PlayerExercise {
  id: string;
  name: string;
  sided: boolean;
  dumbbellLevels: string[];
  tutorial: PlayerClip | null;
  /** The looping clip: `main`, or `right` and `left` for an exercise done on each side. */
  loops: Partial<Record<"main" | Side, PlayerClip>>;
  /** A small still for lists (a frame from the loop). */
  thumbnail: string | null;
  estimate: EstimateExercise;
}

export interface PlayerWorkout {
  id: string;
  title: string;
  description: string;
  level: WorkoutLevel | null;
  coverImageUrl: string | null;
  published: boolean;
  warmup: { name: string; clip: PlayerClip } | null;
  exercises: Record<string, PlayerExercise>;
  blocks: WorkoutBlock[];
  /** Everything the workout (warm-up included) uses. */
  equipment: string[];
  dumbbellLevels: string[];
}

/** A workout in the member list. */
export interface WorkoutCard {
  id: string;
  title: string;
  level: WorkoutLevel | null;
  /** The uploaded cover, or else a frame from the first exercise. */
  imageUrl: string | null;
  minutes: number;
  exerciseCount: number;
  published: boolean;
}

export function loopFor(exercise: PlayerExercise | undefined, side: Side | null): PlayerClip | null {
  if (!exercise) return null;
  return (side ? exercise.loops[side] : exercise.loops.main) ?? null;
}

/** 75 → "1:15". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "12 reps", "0:30", with "each side" for a sided exercise. */
export function amountLabel(measure: Measure, amount: number, sided = false): string {
  const base = measure === "reps" ? `${amount} ${amount === 1 ? "rep" : "reps"}` : clock(amount);
  return sided ? `${base} each side` : base;
}

export function levelLabel(level: WorkoutLevel | null): string | null {
  return LEVELS.find((l) => l.id === level)?.label ?? null;
}

export type EquipmentIcon = "dumbbell" | "mat" | "band" | "chair";

/**
 * "You'll need" pills: one per dumbbell level, so members see every pair they
 * need (a three-level workout never reads "Light & Medium & Heavy"), then the
 * rest of the equipment.
 */
export function equipmentPills(workout: Pick<PlayerWorkout, "equipment" | "dumbbellLevels">): Array<{
  key: string;
  label: string;
  icon: EquipmentIcon;
}> {
  const pills: Array<{ key: string; label: string; icon: EquipmentIcon }> = [];
  const levels = DUMBBELL_LEVELS.filter((l) => workout.dumbbellLevels.includes(l.id));
  if (levels.length) levels.forEach((l) => pills.push({ key: l.id, label: l.label, icon: "dumbbell" }));
  else if (workout.equipment.includes("dumbbells")) pills.push({ key: "dumbbells", label: "Dumbbells", icon: "dumbbell" });
  for (const option of EQUIPMENT_OPTIONS) {
    if (option.id === "dumbbells" || !workout.equipment.includes(option.id)) continue;
    pills.push({ key: option.id, label: option.label, icon: option.id as EquipmentIcon });
  }
  return pills;
}

/** "dumbbells, mat" — for the overview's subtitle. */
export function equipmentText(workout: Pick<PlayerWorkout, "equipment">): string {
  return EQUIPMENT_OPTIONS.filter((o) => workout.equipment.includes(o.id))
    .map((o) => o.label.toLowerCase())
    .join(", ");
}
