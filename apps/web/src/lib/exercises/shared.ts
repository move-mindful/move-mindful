// Exercise types, labels and small helpers shared by the admin server code and
// its client components. No server-only imports here.
//
// Schema: supabase/migrations/009_exercises.sql. Product rules: plan.md, Phase 4.5.

export type ExerciseKind = "exercise" | "warmup";
export type VideoRole = "tutorial" | "loop" | "loop_right" | "loop_left" | "warmup";
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
  tagIds: string[];
  archivedAt: string | null;
  createdAt: string;
  videos: ExerciseVideo[];
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
  tagIds: string[];
  /** Reps in clip for existing loop clips, keyed by exercise_videos id. */
  reps: Record<string, number | null>;
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

export const ROLE_LABELS: Record<VideoRole, string> = {
  tutorial: "Tutorial",
  loop: "Loop",
  loop_right: "Right side loop",
  loop_left: "Left side loop",
  warmup: "Warm-up video",
};

export const ROLE_HINTS: Record<VideoRole, string> = {
  tutorial: "With audio · plays before the exercise",
  loop: "Loops during the set",
  loop_right: "Loops during the set",
  loop_left: "Loops during the set",
  warmup: "With audio · plays once, start to finish",
};

/** Short labels for preview tabs. */
export const ROLE_TAB_LABELS: Record<VideoRole, string> = {
  tutorial: "Tutorial",
  loop: "Loop",
  loop_right: "Right loop",
  loop_left: "Left loop",
  warmup: "Video",
};

export function isLoopRole(role: VideoRole): boolean {
  return role === "loop" || role === "loop_right" || role === "loop_left";
}

/** The video slots an exercise of this shape has, in display order. */
export function rolesFor(kind: ExerciseKind, sided: boolean): VideoRole[] {
  if (kind === "warmup") return ["warmup"];
  return sided ? ["tutorial", "loop_right", "loop_left"] : ["tutorial", "loop"];
}

export interface VideoSlot {
  role: VideoRole;
  /** What members see: the newest ready clip. */
  current: ExerciseVideo | null;
  /** A newer clip that isn't ready yet (uploading, processing or failed). */
  pending: ExerciseVideo | null;
}

export function slotFor(videos: ExerciseVideo[], role: VideoRole): VideoSlot {
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
