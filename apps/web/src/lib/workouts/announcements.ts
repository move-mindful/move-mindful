// Voice announcements: a short spoken line as each rest and each exercise
// begins — "Starting rest, 30 seconds." / "Begin, bicep curl, 10 reps." —
// made with ElevenLabs when a workout is saved in the builder
// (announcements-server.ts) and played by the player like an audio tip, but
// without the tip's bubble. Shared by the server, which makes the lines and
// looks them up, and the player, which finds each step's by its words. No
// server-only imports.

import { workoutSteps, type WorkoutStep } from "@move-mindful/core";
import type { PlayerWorkout } from "@/lib/workouts/player";

/** Who says them, and when. A new voice or model makes new recordings (each is stored by both). */
export const VOICE = {
  /** "mw_The Helpful Android Assistant", from the ElevenLabs Voice Library (picked Oct 2026). */
  voiceId: "AbfSOGQHeh9ZowXq2JHp",
  modelId: "eleven_multilingual_v2",
  /** How far into its rest or exercise (seconds) a line starts. */
  delay: 0.2,
  /** The step's audio tip starts this long (seconds) after its line ends. */
  tipAfter: 1,
  /** The exercise's name stays on screen this long (seconds) past its line's end — or for `cardAlone` with no line. */
  cardAfter: 0.4,
  cardAlone: 2.5,
} as const;

/** A line that's been made: where its file is served from, and how long the speech in it runs (seconds). */
export interface VoiceLine {
  url: string;
  seconds: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A length of time as it's said: "30 seconds", "1 minute", "1 minute 30 seconds". */
function spokenTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (!m) return plural(s, "second");
  return s ? `${plural(m, "minute")} ${plural(s, "second")}` : plural(m, "minute");
}

/**
 * What's said as a step begins: "Starting rest, 30 seconds." for a rest;
 * "Begin, bicep curl, 10 reps." for an exercise ("Begin, side plank, right
 * side, 30 seconds." for a side).
 */
export function announcementText(step: WorkoutStep, exercises: PlayerWorkout["exercises"]): string | null {
  if (step.kind === "rest") return `Starting rest, ${spokenTime(step.seconds)}.`;
  const name = exercises[step.exerciseId]?.name.trim();
  if (!name) return null;
  const amount = step.measure === "reps" ? plural(step.amount, "rep") : spokenTime(step.amount);
  return `Begin, ${name}${step.side ? `, ${step.side} side` : ""}, ${amount}.`;
}

/** Every line a workout says, once each. */
export function workoutAnnouncements(workout: Pick<PlayerWorkout, "blocks" | "exercises">): string[] {
  const estimates = Object.fromEntries(Object.values(workout.exercises).map((e) => [e.id, e.estimate]));
  const lines = workoutSteps(workout.blocks, estimates).map((s) => announcementText(s, workout.exercises));
  return [...new Set(lines.filter((x): x is string => !!x))];
}
