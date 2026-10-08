import "server-only";

import { cache } from "react";
import { aboutMinutes, estimateWorkout, sequenceKey, workoutSteps, type WorkoutBlock } from "@move-mindful/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExercisesByIds } from "@/lib/exercises/server";
import { mp4Url, slotFor, thumbnailUrl, type AdminExercise } from "@/lib/exercises/shared";
import { getWorkoutVideoRows, toCatalog, toWorkout, type BlockRow, type WorkoutRow } from "@/lib/workouts/server";
import type { AdminWorkout, WorkoutVideo } from "@/lib/workouts/shared";
import type { PlayerClip, PlayerExercise, PlayerWorkout, WorkoutCard } from "@/lib/workouts/player";
import { workoutAnnouncements } from "@/lib/workouts/announcements";
import { getVoiceLines } from "@/lib/workouts/announcements-server";

// Member-facing reads. RLS keeps the workout and exercise tables closed to the
// browser, so these run with the service-role client — callers gate access
// first (see app/(player)/workouts/[id]/page.tsx), and only ever hand the
// client a published workout (drafts too, for admins previewing one).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Workouts no longer have a separate warm-up and cool-down. The builder still
// sets them and they're still saved, but the player leaves them out — so no
// Warm-up switch beside Begin, no warm-up or cool-down row, no "Cool down?".
// `true` brings them back.
const WARMUP_AND_COOLDOWN = false;

function toClip(video: Pick<WorkoutVideo, "playbackId" | "mp4File" | "durationSeconds"> | null): PlayerClip | null {
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
  const clip = (role: AdminExercise["videos"][number]["role"]) => toClip(slotFor(e.videos, role).current);
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

async function assemble(workout: AdminWorkout, instructor: PlayerWorkout["instructor"] = null): Promise<PlayerWorkout> {
  const ids = exerciseIds(workout.blocks);
  const warmupId = WARMUP_AND_COOLDOWN ? workout.warmupExerciseId : null;
  const cooldownId = WARMUP_AND_COOLDOWN ? workout.cooldownExerciseId : null;
  if (warmupId) ids.add(warmupId);
  if (cooldownId) ids.add(cooldownId);
  const rows = await getExercisesByIds([...ids]);
  const exercises: Record<string, PlayerExercise> = {};
  for (const e of rows) if (e.kind === "exercise") exercises[e.id] = toPlayerExercise(e);

  // The warm-up and cool-down: library videos, each played start to finish.
  const single = (id: string | null, kind: "warmup" | "cooldown") => {
    const row = rows.find((e) => e.id === id && e.kind === kind);
    const clip = row ? toClip(slotFor(row.videos, kind).current) : null;
    return row && clip ? { name: row.name, clip } : null;
  };

  const equipment = new Set<string>();
  const levels = new Set<string>();
  for (const e of rows) {
    e.equipment.forEach((x) => equipment.add(x));
    e.dumbbellLevels.forEach((x) => levels.add(x));
  }

  const blocks = playableBlocks(workout.blocks, new Set(Object.keys(exercises)));
  return {
    id: workout.id,
    title: workout.title,
    instructor,
    description: workout.description,
    level: workout.level,
    coverImageUrl: workout.coverImageUrl,
    published: !!workout.publishedAt,
    intro: toClip(slotFor(workout.videos, "intro").current),
    warmup: single(warmupId, "warmup"),
    cooldown: single(cooldownId, "cooldown"),
    outro: toClip(slotFor(workout.videos, "outro").current),
    rundownTip: workout.rundownTip,
    voice: await getVoiceLines(workoutAnnouncements({ blocks, exercises })),
    exercises,
    blocks,
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
    const [{ data: w }, { data: rows }, videos] = await Promise.all([
      // With its instructor (workouts.instructor_id → instructors), for the audio tips' photo.
      supabase.from("workouts").select("*, instructor:instructors(name, avatar_url)").eq("id", id).maybeSingle(),
      supabase.from("workout_blocks").select("*").eq("workout_id", id),
      getWorkoutVideoRows(id, true),
    ]);
    if (!w || (!w.published_at && !includeDrafts)) return null;
    const teacher = w.instructor as { name: string; avatar_url: string | null } | null;
    return assemble(
      toWorkout(w as WorkoutRow, (rows ?? []) as BlockRow[], videos),
      teacher ? { name: teacher.name, photoUrl: teacher.avatar_url } : null,
    );
  },
);

/** Published workouts (plus drafts for admins), newest first. */
export async function getWorkoutCards(includeDrafts: boolean): Promise<WorkoutCard[]> {
  const supabase = createAdminClient();
  // Each workout with its blocks, in one query.
  let query = supabase.from("workouts").select("*, workout_blocks(*)").order("created_at", { ascending: false });
  if (!includeDrafts) query = query.not("published_at", "is", null);
  const { data } = await query;
  const workoutRows = (data ?? []) as Array<WorkoutRow & { workout_blocks: BlockRow[] | null }>;
  if (!workoutRows.length) return [];

  const workouts = workoutRows.map(({ workout_blocks, ...w }) => toWorkout(w, workout_blocks ?? []));

  const ids = new Set<string>();
  workouts.forEach((w) => exerciseIds(w.blocks).forEach((id) => ids.add(id)));
  const rows = await getExercisesByIds([...ids]);
  const estimates = Object.fromEntries(rows.map((e) => [e.id, toCatalog(e).estimate]));
  const playable = new Set(rows.filter((e) => e.kind === "exercise").map((e) => e.id));
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
      // The steps as the player builds them (see assemble), so saved progress matches.
      sequenceKey: sequenceKey(workoutSteps(playableBlocks(w.blocks, playable), estimates)),
    };
  });
}
