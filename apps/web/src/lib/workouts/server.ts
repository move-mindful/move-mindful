import "server-only";

import {
  estimateWorkout,
  type Measure,
  type Side,
  type WorkoutBlock,
  type WorkoutMove,
} from "@move-mindful/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { readTips } from "@/lib/workouts/clean";
import { WORKOUT_CLIPS, getExercises, syncPendingClips } from "@/lib/exercises/server";
import { getRatingSummaries } from "@/lib/member/ratings-server";
import { isSingleVideo, paceSeconds, rolesFor, slotFor, type AdminExercise, type VideoRole, type VideoStatus } from "@/lib/exercises/shared";
import type {
  AdminWorkout,
  CatalogExercise,
  WorkoutLevel,
  WorkoutListRow,
  WorkoutVideo,
  WorkoutVideoRole,
} from "@/lib/workouts/shared";

export interface BlockRow {
  id: string;
  workout_id: string;
  parent_id: string | null;
  position: number;
  kind: "exercise" | "rest" | "group";
  exercise_id: string | null;
  sets: number | null;
  rest_between_sets: number | null;
  measure: string | null;
  amount: number | null;
  first_side: string | null;
  rest_seconds: number | null;
  rounds: number | null;
  rest_between_exercises: number | null;
  rest_between_rounds: number | null;
  /** Audio tips, { sets, rests } — missing until 019_workout_audio_tips.sql has run. */
  tips?: { sets?: unknown; rests?: unknown } | null;
}

export interface WorkoutRow {
  id: string;
  title: string;
  description: string | null;
  level: WorkoutLevel | null;
  instructor_id: string | null;
  warmup_exercise_id: string | null;
  /** Missing until 018_intro_outro_cooldown.sql has run. */
  cooldown_exercise_id?: string | null;
  cover_image_url?: string | null;
  published_at: string | null;
  updated_at: string;
}

/** A row of workout_videos (018_intro_outro_cooldown.sql). */
export interface WorkoutVideoRow {
  id: string;
  workout_id: string;
  role: WorkoutVideoRole;
  status: VideoStatus;
  mux_playback_id: string | null;
  mp4_file: string | null;
  duration_seconds: number | string | null;
  original_filename: string | null;
  error: string | null;
  created_at: string;
}

export function toWorkoutVideo(r: WorkoutVideoRow): WorkoutVideo {
  return {
    id: r.id,
    role: r.role,
    status: r.status,
    playbackId: r.mux_playback_id,
    mp4File: r.mp4_file,
    durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    originalFilename: r.original_filename,
    error: r.error,
    createdAt: r.created_at,
  };
}

/** An exercise as the builder needs it, including what the estimate uses. */
export function toCatalog(e: AdminExercise): CatalogExercise {
  const loopRoles: VideoRole[] = e.sided ? ["loop_right", "loop_left"] : ["loop"];
  const main = slotFor(e.videos, isSingleVideo(e.kind) ? e.kind : loopRoles[0]).current;
  const tutorial = slotFor(e.videos, "tutorial").current;
  // A sided exercise's pace: the average of the sides whose pace is known.
  const paces = loopRoles
    .map((r) => slotFor(e.videos, r).current)
    .map((clip) => (clip ? paceSeconds(clip) : null))
    .filter((p): p is number => p != null);
  return {
    id: e.id,
    kind: e.kind,
    name: e.name,
    sided: e.sided,
    timedOnly: e.timedOnly,
    archived: !!e.archivedAt,
    // The tutorial is optional (members skip straight to the exercise without
    // one); every loop — or the warm-up or cool-down video — has to be ready.
    playable: rolesFor(e.kind, e.sided)
      .filter((r) => r !== "tutorial")
      .every((r) => !!slotFor(e.videos, r).current),
    thumbPlaybackId: main?.playbackId ?? null,
    durationSeconds: main?.durationSeconds ?? null,
    equipment: e.equipment,
    dumbbellLevels: e.dumbbellLevels,
    intensity: e.intensity,
    pairIds: e.pairIds,
    estimate: {
      sided: e.sided,
      paceSeconds: paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null,
      tutorialSeconds: tutorial?.durationSeconds ?? null,
    },
    videos: e.videos,
  };
}

/** Every exercise, warm-up and cool-down, archived included (existing workouts may use them). */
export async function getCatalog(): Promise<CatalogExercise[]> {
  return (await getExercises()).map(toCatalog);
}

function toMove(r: BlockRow): WorkoutMove {
  const tips = readTips(r.tips?.sets);
  return {
    exerciseId: r.exercise_id ?? "",
    measure: (r.measure === "time" ? "time" : "reps") as Measure,
    amount: r.amount ?? 1,
    firstSide: (r.first_side === "left" ? "left" : "right") as Side,
    ...(tips && { tips }),
  };
}

function toBlocks(rows: BlockRow[]): WorkoutBlock[] {
  const byPosition = (a: BlockRow, b: BlockRow) => a.position - b.position;
  return rows
    .filter((r) => !r.parent_id)
    .sort(byPosition)
    .map((r): WorkoutBlock => {
      const restTips = readTips(r.tips?.rests);
      const withRestTips = restTips ? { restTips } : {};
      if (r.kind === "rest") return { kind: "rest", seconds: r.rest_seconds ?? 0, ...withRestTips };
      if (r.kind === "group") {
        return {
          kind: "group",
          rounds: r.rounds ?? 1,
          restBetweenExercises: r.rest_between_exercises ?? 0,
          restBetweenRounds: r.rest_between_rounds ?? 0,
          moves: rows.filter((c) => c.parent_id === r.id).sort(byPosition).map(toMove),
          ...withRestTips,
        };
      }
      return { kind: "exercise", move: toMove(r), sets: r.sets ?? 1, restBetweenSets: r.rest_between_sets ?? 0, ...withRestTips };
    });
}

export function toWorkout(w: WorkoutRow, rows: BlockRow[], videos: WorkoutVideoRow[] = []): AdminWorkout {
  return {
    id: w.id,
    title: w.title,
    description: w.description ?? "",
    level: w.level,
    instructorId: w.instructor_id,
    warmupExerciseId: w.warmup_exercise_id,
    cooldownExerciseId: w.cooldown_exercise_id ?? null,
    coverImageUrl: w.cover_image_url ?? null,
    publishedAt: w.published_at,
    blocks: toBlocks(rows),
    videos: videos.map(toWorkoutVideo),
  };
}

/**
 * A workout's intro and outro clips — every row (the builder shows ones still
 * processing), or only ready ones for the player. Empty until
 * 018_intro_outro_cooldown.sql has run.
 */
export async function getWorkoutVideoRows(id: string, readyOnly: boolean): Promise<WorkoutVideoRow[]> {
  const supabase = createAdminClient();
  let query = supabase.from("workout_videos").select("*").eq("workout_id", id);
  if (readyOnly) query = query.eq("status", "ready");
  const { data } = await query;
  return (data ?? []) as WorkoutVideoRow[];
}

/** One workout for the builder, its intro and outro brought up to date with Mux first. */
export async function getWorkout(id: string): Promise<AdminWorkout | null> {
  const supabase = createAdminClient();
  await syncPendingClips(supabase, WORKOUT_CLIPS, id);
  const [{ data: w }, { data: rows }, videos] = await Promise.all([
    supabase.from("workouts").select("*").eq("id", id).maybeSingle(),
    supabase.from("workout_blocks").select("*").eq("workout_id", id),
    getWorkoutVideoRows(id, false),
  ]);
  if (!w) return null;
  return toWorkout(w as WorkoutRow, (rows ?? []) as BlockRow[], videos);
}

/** Every workout for the admin list, newest edits first, with its estimate. */
export async function getWorkouts(): Promise<WorkoutListRow[]> {
  const supabase = createAdminClient();
  const [{ data: workouts }, { data: rows }, catalog, ratings] = await Promise.all([
    supabase.from("workouts").select("*").order("updated_at", { ascending: false }),
    supabase.from("workout_blocks").select("*"),
    getCatalog(),
    getRatingSummaries(),
  ]);
  const estimates = Object.fromEntries(catalog.map((c) => [c.id, c.estimate]));
  return ((workouts ?? []) as WorkoutRow[]).map((w) => {
    const blocks = toBlocks(((rows ?? []) as BlockRow[]).filter((r) => r.workout_id === w.id));
    const exerciseIds = new Set<string>();
    for (const b of blocks) {
      if (b.kind === "exercise") exerciseIds.add(b.move.exerciseId);
      if (b.kind === "group") b.moves.forEach((m) => exerciseIds.add(m.exerciseId));
    }
    return {
      id: w.id,
      title: w.title,
      level: w.level,
      publishedAt: w.published_at,
      updatedAt: w.updated_at,
      exerciseCount: exerciseIds.size,
      totalSeconds: estimateWorkout(blocks, estimates).totalSeconds,
      hasWarmup: !!w.warmup_exercise_id,
      hasCooldown: !!w.cooldown_exercise_id,
      coverImageUrl: w.cover_image_url ?? null,
      rating: ratings.get(w.id) ?? null,
    };
  });
}
