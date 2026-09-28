import "server-only";

import { cache } from "react";
import { aboutMinutes, estimateWorkout, type WorkoutBlock } from "@move-mindful/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExercisesByIds } from "@/lib/exercises/server";
import { mp4Url, slotFor, thumbnailUrl, type AdminExercise, type ExerciseVideo } from "@/lib/exercises/shared";
import { toCatalog, toWorkout, type BlockRow, type WorkoutRow } from "@/lib/workouts/server";
import type { AdminWorkout } from "@/lib/workouts/shared";
import type { PlayerClip, PlayerExercise, PlayerWorkout, WorkoutCard } from "@/lib/workouts/player";

// Member-facing reads. RLS keeps the workout and exercise tables closed to the
// browser, so these run with the service-role client — callers gate access
// first (see app/(player)/workouts/[id]/page.tsx), and only ever hand the
// client a published workout (drafts too, for admins previewing one).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toClip(video: ExerciseVideo | null): PlayerClip | null {
  const url = video && mp4Url(video);
  if (!video?.playbackId || !url) return null;
  return {
    url,
    poster: `https://image.mux.com/${video.playbackId}/thumbnail.webp?width=720&time=0`,
    durationSeconds: video.durationSeconds,
  };
}

function exerciseIds(blocks: WorkoutBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.kind === "exercise") ids.add(b.move.exerciseId);
    if (b.kind === "group") b.moves.forEach((m) => ids.add(m.exerciseId));
  }
  return ids;
}

function toPlayerExercise(e: AdminExercise): PlayerExercise {
  const clip = (role: ExerciseVideo["role"]) => toClip(slotFor(e.videos, role).current);
  const loops: PlayerExercise["loops"] = e.sided
    ? { right: clip("loop_right") ?? undefined, left: clip("loop_left") ?? undefined }
    : { main: clip("loop") ?? undefined };
  const thumbVideo = slotFor(e.videos, e.sided ? "loop_right" : "loop").current;
  return {
    id: e.id,
    name: e.name,
    sided: e.sided,
    dumbbellLevels: e.dumbbellLevels,
    tutorial: clip("tutorial"),
    loops,
    thumbnail: thumbVideo?.playbackId ? thumbnailUrl(thumbVideo.playbackId, 112, 144) : null,
    estimate: toCatalog(e).estimate,
  };
}

/** Drop moves whose exercise is gone, and groups left empty. */
function playableBlocks(blocks: WorkoutBlock[], known: Set<string>): WorkoutBlock[] {
  return blocks
    .map((b): WorkoutBlock | null => {
      if (b.kind === "exercise") return known.has(b.move.exerciseId) ? b : null;
      if (b.kind === "group") {
        const moves = b.moves.filter((m) => known.has(m.exerciseId));
        return moves.length ? { ...b, moves } : null;
      }
      return b;
    })
    .filter((b): b is WorkoutBlock => !!b);
}

async function assemble(workout: AdminWorkout): Promise<PlayerWorkout> {
  const ids = exerciseIds(workout.blocks);
  if (workout.warmupExerciseId) ids.add(workout.warmupExerciseId);
  const rows = await getExercisesByIds([...ids]);
  const exercises: Record<string, PlayerExercise> = {};
  for (const e of rows) if (e.kind === "exercise") exercises[e.id] = toPlayerExercise(e);

  const warmupRow = rows.find((e) => e.id === workout.warmupExerciseId && e.kind === "warmup");
  const warmupClip = warmupRow ? toClip(slotFor(warmupRow.videos, "warmup").current) : null;

  const equipment = new Set<string>();
  const levels = new Set<string>();
  for (const e of rows) {
    e.equipment.forEach((x) => equipment.add(x));
    e.dumbbellLevels.forEach((x) => levels.add(x));
  }

  return {
    id: workout.id,
    title: workout.title,
    description: workout.description,
    level: workout.level,
    coverImageUrl: workout.coverImageUrl,
    published: !!workout.publishedAt,
    warmup: warmupRow && warmupClip ? { name: warmupRow.name, clip: warmupClip } : null,
    exercises,
    blocks: playableBlocks(workout.blocks, new Set(Object.keys(exercises))),
    equipment: [...equipment],
    dumbbellLevels: [...levels],
  };
}

/**
 * One workout for the player, or null when it doesn't exist or isn't
 * published (admins also get drafts, to preview them). Cached per request, so
 * the page and its metadata share one read.
 */
export const getPlayerWorkout = cache(
  async (id: string, includeDrafts: boolean): Promise<PlayerWorkout | null> => {
    if (!UUID.test(id)) return null;
    const supabase = createAdminClient();
    const [{ data: w }, { data: rows }] = await Promise.all([
      supabase.from("workouts").select("*").eq("id", id).maybeSingle(),
      supabase.from("workout_blocks").select("*").eq("workout_id", id),
    ]);
    if (!w || (!w.published_at && !includeDrafts)) return null;
    return assemble(toWorkout(w as WorkoutRow, (rows ?? []) as BlockRow[]));
  },
);

/** Published workouts (plus drafts for admins), newest first. */
export async function getWorkoutCards(includeDrafts: boolean): Promise<WorkoutCard[]> {
  const supabase = createAdminClient();
  let query = supabase.from("workouts").select("*").order("created_at", { ascending: false });
  if (!includeDrafts) query = query.not("published_at", "is", null);
  const { data } = await query;
  const workoutRows = (data ?? []) as WorkoutRow[];
  if (!workoutRows.length) return [];

  const { data: blockRows } = await supabase
    .from("workout_blocks")
    .select("*")
    .in("workout_id", workoutRows.map((w) => w.id));
  const workouts = workoutRows.map((w) =>
    toWorkout(w, ((blockRows ?? []) as BlockRow[]).filter((r) => r.workout_id === w.id)),
  );

  const ids = new Set<string>();
  workouts.forEach((w) => exerciseIds(w.blocks).forEach((id) => ids.add(id)));
  const rows = await getExercisesByIds([...ids]);
  const estimates = Object.fromEntries(rows.map((e) => [e.id, toCatalog(e).estimate]));
  // A card with no uploaded cover shows a frame from its first exercise.
  const stills = new Map(
    rows.map((e) => {
      const loop = slotFor(e.videos, e.sided ? "loop_right" : "loop").current;
      return [e.id, loop?.playbackId ? thumbnailUrl(loop.playbackId, 600, 800) : null];
    }),
  );

  return workouts.map((w) => {
    const used = [...exerciseIds(w.blocks)];
    return {
      id: w.id,
      title: w.title,
      level: w.level,
      imageUrl: w.coverImageUrl ?? stills.get(used[0]) ?? null,
      minutes: aboutMinutes(estimateWorkout(w.blocks, estimates).totalSeconds),
      exerciseCount: used.length,
      published: !!w.publishedAt,
    };
  });
}
