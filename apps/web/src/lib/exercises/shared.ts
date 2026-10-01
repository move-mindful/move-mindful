// Exercise types, labels and small helpers shared by the admin server code and
// its client components. No server-only imports here.
//
// Schema: supabase/migrations/009_exercises.sql. Product rules: plan.md, Phase 4.5.

/**
 * An exercise (a tutorial plus loops), or one of the single videos that play
 * once, start to finish: a warm-up or a cool-down (018_intro_outro_cooldown.sql).
 */
export type ExerciseKind = "exercise" | "warmup" | "cooldown";
export type VideoRole = "tutorial" | "loop" | "loop_right" | "loop_left" | "warmup" | "cooldown";
export type VideoStatus = "uploading" | "processing" | "ready" | "errored";

export interface ExerciseVideo {
  id: string;
  role: VideoRole;
  status: VideoStatus;
  playbackId: string | null;
  /** MP4 static rendition to play, e.g. "1080p.mp4". Set once ready. */
  mp4File: string | null;
  durationSeconds: number | null;
  repsInClip: number | null;
  originalFilename: string | null;
  error: string | null;
  createdAt: string;
}

export interface AdminExercise {
  id: string;
  kind: ExerciseKind;
  name: string;
  sided: boolean;
  timedOnly: boolean;
  equipment: string[];
  dumbbellLevels: string[];
  /** 1 to 4, higher is more intense; exercises only, null when not set. */
  intensity: number | null;
  tagIds: string[];
  /** Exercises it pairs well with in a superset or circuit (both ways). */
  pairIds: string[];
  archivedAt: string | null;
  createdAt: string;
  videos: ExerciseVideo[];
  /** How many workouts use it (in a block, or as their warm-up or cool-down). */
  usedIn: number;
}

/** What the exercise form sends to `saveExercise`. */
export interface ExerciseInput {
  /** Omit to create. */
  id?: string;
  kind: ExerciseKind;
  name: string;
  sided: boolean;
  timedOnly: boolean;
  equipment: string[];
  dumbbellLevels: string[];
  intensity: number | null;
  tagIds: string[];
  pairIds: string[];
  /** Reps in clip for existing loop clips, keyed by exercise_videos id. */
  reps: Record<string, number | null>;
}

/** Another exercise, as the "Pairs well with" picker lists it. */
export interface ExerciseOption {
  id: string;
  name: string;
  archived: boolean;
  /** Its live loop (the right side's, when sided), for the thumbnail. */
  thumbPlaybackId: string | null;
}

export interface ExerciseTag {
  id: string;
  name: string;
  /** How many exercises (archived included) carry this tag. */
  count: number;
}

export const EQUIPMENT_OPTIONS = [
  { id: "dumbbells", label: "Dumbbells" },
  { id: "mat", label: "Mat" },
  { id: "band", label: "Resistance band" },
  { id: "chair", label: "Chair" },
] as const;

export const DUMBBELL_LEVELS = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
] as const;

/**
 * Exercise intensity (014_exercise_intensity.sql): plain numbers on purpose —
 * no words attached, so what each level means is the admin's call.
 */
export const INTENSITY_LEVELS = [1, 2, 3, 4] as const;

export function intensityLabel(value: number | null): string {
  return value ? `${value} of 4` : "Not set";
}

export const ROLE_LABELS: Record<VideoRole, string> = {
  tutorial: "Tutorial",
  loop: "Loop",
  loop_right: "Right side loop",
  loop_left: "Left side loop",
  warmup: "Warm-up video",
  cooldown: "Cool-down video",
};

export const ROLE_HINTS: Record<VideoRole, string> = {
  tutorial: "With audio · plays before the exercise",
  loop: "Loops during the set",
  loop_right: "Loops during the set",
  loop_left: "Loops during the set",
  warmup: "With audio · plays once, start to finish",
  cooldown: "With audio · plays once, start to finish",
};

/** Short labels for preview tabs. */
export const ROLE_TAB_LABELS: Record<VideoRole, string> = {
  tutorial: "Tutorial",
  loop: "Loop",
  loop_right: "Right loop",
  loop_left: "Left loop",
  warmup: "Video",
  cooldown: "Video",
};

/** What each kind is called in the admin, mid-sentence. */
export const KIND_NOUNS: Record<ExerciseKind, string> = {
  exercise: "exercise",
  warmup: "warm-up",
  cooldown: "cool-down",
};

/** A warm-up or cool-down: one video that plays once, start to finish. */
export function isSingleVideo(kind: ExerciseKind): kind is "warmup" | "cooldown" {
  return kind === "warmup" || kind === "cooldown";
}

export function isLoopRole(role: VideoRole): boolean {
  return role === "loop" || role === "loop_right" || role === "loop_left";
}

/** The video slots an exercise of this shape has, in display order. */
export function rolesFor(kind: ExerciseKind, sided: boolean): VideoRole[] {
  if (isSingleVideo(kind)) return [kind];
  return sided ? ["tutorial", "loop_right", "loop_left"] : ["tutorial", "loop"];
}

/** What a slot needs to know about a clip: an exercise's, or a workout's intro or outro. */
type SlotClip = { role: string; status: VideoStatus; createdAt: string };

export interface VideoSlot<V extends SlotClip = ExerciseVideo> {
  role: V["role"];
  /** What members see: the newest ready clip. */
  current: V | null;
  /** A newer clip that isn't ready yet (uploading, processing or failed). */
  pending: V | null;
}

export function slotFor<V extends SlotClip>(videos: V[], role: V["role"]): VideoSlot<V> {
  const forRole = videos
    .filter((v) => v.role === role)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const current = forRole.find((v) => v.status === "ready") ?? null;
  const newest = forRole[0] ?? null;
  const pending = newest && newest.status !== "ready" ? newest : null;
  return { role, current, pending };
}

export function mp4Url(video: Pick<ExerciseVideo, "playbackId" | "mp4File">): string | null {
  if (!video.playbackId || !video.mp4File) return null;
  return `https://stream.mux.com/${video.playbackId}/${video.mp4File}`;
}

export function thumbnailUrl(playbackId: string, width: number, height: number): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&height=${height}&fit_mode=smartcrop`;
}

/** Seconds per rep, from a loop clip's length and the reps it shows. */
export function paceSeconds(video: Pick<ExerciseVideo, "durationSeconds" | "repsInClip">): number | null {
  if (!video.durationSeconds || !video.repsInClip) return null;
  return video.durationSeconds / video.repsInClip;
}

export function formatPace(seconds: number): string {
  return `${Number(seconds.toFixed(1))}s per rep`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function equipmentLabel(id: string): string {
  return EQUIPMENT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function levelsLabel(levels: string[]): string {
  return DUMBBELL_LEVELS.filter((l) => levels.includes(l.id))
    .map((l) => l.label)
    .join(" / ");
}

/** Things worth flagging in the library, e.g. "Processing" or "No tutorial". */
export function attentionFlags(exercise: AdminExercise): string[] {
  const slots = rolesFor(exercise.kind, exercise.sided).map((r) => slotFor(exercise.videos, r));
  const flags: string[] = [];
  if (slots.some((s) => s.pending?.status === "errored")) flags.push("Upload failed");
  if (slots.some((s) => s.pending && s.pending.status !== "errored")) flags.push("Processing");
  const missing = slots.filter((s) => !s.current && !s.pending);
  if (missing.some((s) => s.role === "tutorial")) flags.push("No tutorial");
  if (missing.some((s) => s.role !== "tutorial")) flags.push("Missing clip");
  return flags;
}
