// The member player's view of a workout: built on the server
// (lib/workouts/member.ts) and handed to the client player. No server-only
// imports. The step model and state machine live in @move-mindful/core.

import { isWarmup, WARMUP_CUE, type AudioTip, type EstimateExercise, type Measure, type Side, type WorkoutBlock, type WorkoutStep } from "@move-mindful/core";
import { DUMBBELL_LEVELS, EQUIPMENT_OPTIONS } from "@/lib/exercises/shared";
import { LEVELS, type WorkoutLevel } from "@/lib/workouts/shared";
import type { VoiceLine } from "@/lib/workouts/announcements";

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
  /** Who's teaching it: their photo is on screen while one of their audio tips plays. */
  instructor: { name: string; photoUrl: string | null } | null;
  description: string;
  level: WorkoutLevel | null;
  coverImageUrl: string | null;
  published: boolean;
  /** The workout's own video before everything else (and the warm-up), if it has one. */
  intro: PlayerClip | null;
  warmup: { name: string; clip: PlayerClip } | null;
  /** Offered after the last exercise ("Cool down?"). */
  cooldown: { name: string; clip: PlayerClip } | null;
  /** The workout's own video after the exercises (and the cool-down), before the summary. */
  outro: PlayerClip | null;
  /** The workout overview's tip, after the intro: the section plays only when there is one. */
  rundownTip: AudioTip | null;
  /** Its voice announcements that have been made, by their words (see announcementText). */
  voice: Record<string, VoiceLine>;
  exercises: Record<string, PlayerExercise>;
  blocks: WorkoutBlock[];
  /** Everything the workout (warm-up and cool-down included) uses. */
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
  /** Its step sequence's fingerprint (see sequenceKey in core), to check saved progress against. */
  sequenceKey: string;
}

export function loopFor(exercise: PlayerExercise | undefined, side: Side | null): PlayerClip | null {
  if (!exercise) return null;
  return (side ? exercise.loops[side] : exercise.loops.main) ?? null;
}

/** A set's loop — its side's — or any loop the exercise has. */
function setLoop(step: WorkoutStep & { kind: "set" }, exercises: Record<string, PlayerExercise>): PlayerClip | undefined {
  const loops = exercises[step.exerciseId]?.loops;
  return (step.side ? loops?.[step.side] : loops?.main) ?? loops?.main ?? loops?.right ?? loops?.left;
}

/**
 * Each exercise once, in the order the workout first meets it, with one loop
 * clip — its first side's — however many sets, rounds and sides it has. The
 * preview's montage plays these.
 */
export function exerciseLineup(
  steps: WorkoutStep[],
  exercises: Record<string, PlayerExercise>,
): Array<{ exerciseId: string; clip: PlayerClip }> {
  const seen = new Set<string>();
  const result: Array<{ exerciseId: string; clip: PlayerClip }> = [];
  for (const step of steps) {
    if (step.kind !== "set" || seen.has(step.exerciseId)) continue;
    seen.add(step.exerciseId);
    const clip = setLoop(step, exercises);
    if (clip) result.push({ exerciseId: step.exerciseId, clip });
  }
  return result;
}

/** One entry of the workout overview: an exercise (its id), or the warm-up (WARMUP_CUE) with its exercises' loops. */
export interface OverviewEntry {
  key: string;
  clips: PlayerClip[];
}

/**
 * The workout overview's lineup, as its rows are lit and its cues name them:
 * the warm-up as one entry — its exercises' loops, taking turns — then each
 * exercise after it once, in the order the workout first meets it.
 */
export function overviewLineup(
  steps: WorkoutStep[],
  blocks: WorkoutBlock[],
  exercises: Record<string, PlayerExercise>,
): OverviewEntry[] {
  const warmup: OverviewEntry = { key: WARMUP_CUE, clips: [] };
  const warmupSeen = new Set<string>();
  const seen = new Set<string>();
  const rest: OverviewEntry[] = [];
  for (const step of steps) {
    if (step.kind !== "set") continue;
    const inWarmup = isWarmup(blocks[step.block]);
    const done = inWarmup ? warmupSeen : seen;
    if (done.has(step.exerciseId)) continue;
    done.add(step.exerciseId);
    const clip = setLoop(step, exercises);
    if (!clip) continue;
    if (inWarmup) warmup.clips.push(clip);
    else rest.push({ key: step.exerciseId, clips: [clip] });
  }
  return warmup.clips.length ? [warmup, ...rest] : rest;
}

/**
 * The overview entry's loop on screen `ms` into the section: the warm-up's
 * take turns, `RUNDOWN.secondsEach` apiece (`eachMs`).
 */
export function entryClip(entry: OverviewEntry | undefined, ms: number, eachMs: number): PlayerClip | undefined {
  if (!entry?.clips.length) return undefined;
  return entry.clips[Math.floor(Math.max(0, ms) / eachMs) % entry.clips.length];
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
