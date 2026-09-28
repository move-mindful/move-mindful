import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { mux } from "@/lib/mux/client";
import type {
  AdminExercise,
  ExerciseKind,
  ExerciseTag,
  ExerciseVideo,
  VideoRole,
  VideoStatus,
} from "@/lib/exercises/shared";

type AdminClient = ReturnType<typeof createAdminClient>;

interface VideoRow {
  id: string;
  exercise_id: string;
  role: VideoRole;
  status: VideoStatus;
  mux_upload_id: string | null;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mp4_file: string | null;
  duration_seconds: number | string | null;
  reps_in_clip: number | null;
  original_filename: string | null;
  error: string | null;
  created_at: string;
}

interface ExerciseRow {
  id: string;
  kind: ExerciseKind;
  name: string;
  sided: boolean;
  timed_only: boolean;
  equipment: string[] | null;
  dumbbell_levels: string[] | null;
  archived_at: string | null;
  created_at: string;
}

// Every exercise clip asks Mux for these MP4 static renditions (the player plays
// MP4s — see plan.md, Phase 4.5 step 1). 1080p is the one we play; 720p is the
// fallback for footage too small for 1080p, where Mux skips the 1080p file.
export const EXERCISE_STATIC_RENDITIONS = [{ resolution: "1080p" }, { resolution: "720p" }] as const;
const MP4_PREFERENCE = ["1080p.mp4", "720p.mp4"] as const;

function toVideo(r: VideoRow): ExerciseVideo {
  return {
    id: r.id,
    role: r.role,
    status: r.status,
    playbackId: r.mux_playback_id,
    mp4File: r.mp4_file,
    durationSeconds: r.duration_seconds == null ? null : Number(r.duration_seconds),
    repsInClip: r.reps_in_clip,
    originalFilename: r.original_filename,
    error: r.error,
    createdAt: r.created_at,
  };
}

/**
 * Delete a clip's Mux asset, or cancel its upload if the bytes never arrived.
 * Best effort: a clip Mux has already lost shouldn't block deleting the row.
 */
export async function deleteMuxVideo(row: {
  mux_asset_id: string | null;
  mux_upload_id: string | null;
}): Promise<void> {
  try {
    let assetId = row.mux_asset_id;
    if (!assetId && row.mux_upload_id) {
      const upload = await mux.video.uploads.retrieve(row.mux_upload_id);
      assetId = upload.asset_id ?? null;
      if (!assetId) {
        await mux.video.uploads.cancel(row.mux_upload_id);
        return;
      }
    }
    if (assetId) await mux.video.assets.delete(assetId);
  } catch {
    // Already gone, or Mux is unreachable — nothing more to do here.
  }
}

// Once a replacement is ready, the clips it replaced go (rows and Mux assets).
async function retireOlder(supabase: AdminClient, row: VideoRow): Promise<void> {
  const { data: older } = await supabase
    .from("exercise_videos")
    .select("id, mux_asset_id, mux_upload_id")
    .eq("exercise_id", row.exercise_id)
    .eq("role", row.role)
    .lt("created_at", row.created_at);
  if (!older?.length) return;
  await Promise.all(older.map((o) => deleteMuxVideo(o)));
  await supabase
    .from("exercise_videos")
    .delete()
    .in(
      "id",
      older.map((o) => o.id),
    );
}

// Which MP4 to play: the first preference that's ready, "wait" while a better
// one is still being made, null when none can be made.
function chooseMp4(files: Array<{ name?: string; status?: string }>): string | "wait" | null {
  if (files.length === 0) return "wait";
  for (const name of MP4_PREFERENCE) {
    const status = files.find((f) => f.name === name)?.status;
    if (status === "ready") return name;
    if (status === "preparing") return "wait";
  }
  return null;
}

async function syncOne(supabase: AdminClient, row: VideoRow): Promise<void> {
  try {
    const patch: Partial<VideoRow> = {};
    let assetId = row.mux_asset_id;

    if (!assetId && row.mux_upload_id) {
      const upload = await mux.video.uploads.retrieve(row.mux_upload_id);
      if (upload.asset_id) {
        assetId = upload.asset_id;
        patch.mux_asset_id = assetId;
        patch.status = "processing";
      } else if (["errored", "cancelled", "timed_out"].includes(upload.status)) {
        await supabase
          .from("exercise_videos")
          .update({
            status: "errored",
            error: upload.status === "timed_out" ? "The upload never finished." : `Upload ${upload.status}.`,
          })
          .eq("id", row.id);
        return;
      } else {
        return; // Still waiting for the file to arrive.
      }
    }
    if (!assetId) return;

    const asset = await mux.video.assets.retrieve(assetId);
    if (asset.status === "errored") {
      patch.status = "errored";
      patch.error = asset.errors?.messages?.join(" ") || "Mux couldn't process this video.";
    } else {
      const playback =
        asset.playback_ids?.find((p) => p.policy === "public") ?? asset.playback_ids?.[0];
      if (playback?.id) patch.mux_playback_id = playback.id;
      if (asset.duration) patch.duration_seconds = asset.duration;
      if (asset.status === "ready") {
        const mp4 = chooseMp4(asset.static_renditions?.files ?? []);
        if (mp4 === null) {
          patch.status = "errored";
          patch.error = "Mux couldn't make an MP4 of this video.";
        } else if (mp4 !== "wait") {
          patch.status = "ready";
          patch.mp4_file = mp4;
          patch.error = null;
        }
      }
    }

    if (Object.keys(patch).length) {
      await supabase.from("exercise_videos").update(patch).eq("id", row.id);
    }
    if (patch.status === "ready") await retireOlder(supabase, row);
  } catch {
    // Mux unreachable or the asset is gone; the next page load tries again.
  }
}

/**
 * Bring every clip that isn't ready yet up to date with Mux: upload → asset →
 * encoded → MP4 made. There are no Mux webhooks, so admin pages run this on
 * load (and the edit page re-checks every few seconds while clips process).
 */
export async function syncPendingVideos(supabase: AdminClient, exerciseId?: string): Promise<void> {
  let query = supabase.from("exercise_videos").select("*").in("status", ["uploading", "processing"]);
  if (exerciseId) query = query.eq("exercise_id", exerciseId);
  const { data } = await query;
  await Promise.all(((data ?? []) as VideoRow[]).map((row) => syncOne(supabase, row)));
}

/** How many workouts use each exercise — in a block, or as their warm-up. */
export async function getExerciseUsage(supabase: AdminClient): Promise<Map<string, number>> {
  const [{ data: blocks }, { data: workouts }] = await Promise.all([
    supabase.from("workout_blocks").select("workout_id, exercise_id").not("exercise_id", "is", null),
    supabase.from("workouts").select("id, warmup_exercise_id").not("warmup_exercise_id", "is", null),
  ]);
  const byExercise = new Map<string, Set<string>>();
  const add = (exerciseId: string, workoutId: string) => {
    if (!byExercise.has(exerciseId)) byExercise.set(exerciseId, new Set());
    byExercise.get(exerciseId)!.add(workoutId);
  };
  for (const b of blocks ?? []) add(b.exercise_id as string, b.workout_id as string);
  for (const w of workouts ?? []) add(w.warmup_exercise_id as string, w.id as string);
  return new Map([...byExercise].map(([id, set]) => [id, set.size]));
}

function assemble(
  exercises: ExerciseRow[],
  videos: VideoRow[],
  links: Array<{ exercise_id: string; tag_id: string }>,
  usage: Map<string, number>,
): AdminExercise[] {
  return exercises.map((e) => ({
    id: e.id,
    kind: e.kind,
    name: e.name,
    sided: e.sided,
    timedOnly: e.timed_only,
    equipment: e.equipment ?? [],
    dumbbellLevels: e.dumbbell_levels ?? [],
    tagIds: links.filter((l) => l.exercise_id === e.id).map((l) => l.tag_id),
    archivedAt: e.archived_at,
    createdAt: e.created_at,
    videos: videos.filter((v) => v.exercise_id === e.id).map(toVideo),
    usedIn: usage.get(e.id) ?? 0,
  }));
}

/** Every exercise and warm-up (archived included), with clips and tag ids. */
export async function getExercises(): Promise<AdminExercise[]> {
  const supabase = createAdminClient();
  await syncPendingVideos(supabase);
  const [{ data: exercises }, { data: videos }, { data: links }, usage] = await Promise.all([
    supabase.from("exercises").select("*").order("name"),
    supabase.from("exercise_videos").select("*"),
    supabase.from("exercise_tag_links").select("exercise_id, tag_id"),
    getExerciseUsage(supabase),
  ]);
  return assemble(
    (exercises ?? []) as ExerciseRow[],
    (videos ?? []) as VideoRow[],
    links ?? [],
    usage,
  );
}

export async function getExercise(id: string): Promise<AdminExercise | null> {
  const supabase = createAdminClient();
  await syncPendingVideos(supabase, id);
  const [{ data: exercise }, { data: videos }, { data: links }, usage] = await Promise.all([
    supabase.from("exercises").select("*").eq("id", id).maybeSingle(),
    supabase.from("exercise_videos").select("*").eq("exercise_id", id),
    supabase.from("exercise_tag_links").select("exercise_id, tag_id").eq("exercise_id", id),
    getExerciseUsage(supabase),
  ]);
  if (!exercise) return null;
  return assemble([exercise as ExerciseRow], (videos ?? []) as VideoRow[], links ?? [], usage)[0];
}

/** All exercise tags in their display order, with how many exercises use each. */
export async function getExerciseTags(): Promise<ExerciseTag[]> {
  const supabase = createAdminClient();
  const [{ data: tags }, { data: links }] = await Promise.all([
    supabase.from("exercise_tags").select("id, name").order("position").order("name"),
    supabase.from("exercise_tag_links").select("tag_id"),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.tag_id, (counts.get(l.tag_id) ?? 0) + 1);
  return (tags ?? []).map((t) => ({ id: t.id, name: t.name, count: counts.get(t.id) ?? 0 }));
}
