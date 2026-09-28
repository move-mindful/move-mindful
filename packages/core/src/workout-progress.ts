/**
 * Saved progress for a workout: how far a member got, and whether that spot
 * still means the same thing when they come back (plan.md, Phase 4.5 step 5).
 * The web player saves it as it goes; the preview offers "Resume · N%".
 */

import type { SetStep, WorkoutStep } from "./workouts";

/**
 * How long saved progress can be resumed, from its last save. After that
 * Resume goes away and the workout starts fresh: a week off means warming up
 * and starting again, not jumping in cold halfway through. The session is
 * kept, just not offered.
 */
export const RESUME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkoutProgress {
  /** Sets finished before this point (both sides of a sided set count as one). */
  setsDone: number;
  setsTotal: number;
  /** Share of the workout's estimated time done, 0–100 (100 only once it's finished). */
  percent: number;
}

/**
 * A short fingerprint of the workout's sequence — which exercise, which side,
 * or a rest, at every step. A saved step number only means the same place
 * while this matches: if the workout is edited so steps move (sets added or
 * removed, exercises swapped), the key changes and the saved spot is dropped.
 * Changing reps, times or rest lengths keeps it.
 */
export function sequenceKey(steps: WorkoutStep[]): string {
  const text = steps.map((s) => (s.kind === "set" ? `${s.exerciseId}:${s.side ?? ""}` : "rest")).join("|");
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Progress at step `index` — everything before it done; past the end, finished. */
export function workoutProgress(steps: WorkoutStep[], index: number): WorkoutProgress {
  const sets = steps.filter((s): s is SetStep => s.kind === "set");
  const setsTotal = sets.length ? sets[sets.length - 1].setIndex + 1 : 0;
  if (index >= steps.length) return { setsDone: setsTotal, setsTotal, percent: 100 };
  const next = steps.slice(index).find((s): s is SetStep => s.kind === "set");
  const total = steps.reduce((sum, s) => sum + s.seconds, 0);
  const done = steps.slice(0, index).reduce((sum, s) => sum + s.seconds, 0);
  return {
    setsDone: next ? next.setIndex : setsTotal,
    setsTotal,
    percent: total ? Math.min(99, Math.round((100 * done) / total)) : 0,
  };
}

/**
 * Where to pick up a saved workout: the start of the set it was on (the one
 * after, if it was saved on a rest). Null when there's nothing to resume —
 * the workout has changed since (see sequenceKey), the step is out of range,
 * or it's still on the very first set.
 */
export function resumeFrom(steps: WorkoutStep[], saved: { step: number; sequenceKey: string }): number | null {
  if (saved.sequenceKey !== sequenceKey(steps)) return null;
  for (let i = Math.max(0, saved.step); i < steps.length; i++) {
    if (steps[i].kind === "set") return i > 0 ? i : null;
  }
  return null;
}
