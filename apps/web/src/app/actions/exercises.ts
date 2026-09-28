"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mux } from "@/lib/mux/client";
import { requestOrigin } from "@/lib/mux/request-origin";
import {
  EXERCISE_STATIC_RENDITIONS,
  deleteMuxVideo,
  syncPendingVideos,
} from "@/lib/exercises/server";
import {
  DUMBBELL_LEVELS,
  EQUIPMENT_OPTIONS,
  ROLE_LABELS,
  isLoopRole,
  rolesFor,
  type ExerciseInput,
  type ExerciseKind,
  type ExerciseTag,
  type VideoRole,
} from "@/lib/exercises/shared";

type AdminClient = ReturnType<typeof createAdminClient>;

function revalidateExercises(id?: string) {
  revalidatePath("/admin/exercises");
  if (id) revalidatePath(`/admin/exercises/${id}`);
}

function cleanReps(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

async function syncTags(supabase: AdminClient, exerciseId: string, tagIds: string[]) {
  const wanted = [...new Set(tagIds ?? [])];
  const { data: valid } = wanted.length
    ? await supabase.from("exercise_tags").select("id").in("id", wanted)
    : { data: [] };
  await supabase.from("exercise_tag_links").delete().eq("exercise_id", exerciseId);
  if (valid?.length) {
    await supabase
      .from("exercise_tag_links")
      .insert(valid.map((t) => ({ exercise_id: exerciseId, tag_id: t.id })));
  }
}

// Turning "done on each side" on or off changes which clips an exercise has; the
// clips for slots it no longer has are deleted on save (the form warns first).
async function removeUnusedClips(
  supabase: AdminClient,
  exerciseId: string,
  kind: ExerciseKind,
  sided: boolean,
) {
  const keep = rolesFor(kind, sided);
  const { data } = await supabase
    .from("exercise_videos")
    .select("id, role, mux_asset_id, mux_upload_id")
    .eq("exercise_id", exerciseId);
  const unused = (data ?? []).filter((v) => !keep.includes(v.role as VideoRole));
  if (!unused.length) return;
  await Promise.all(unused.map((v) => deleteMuxVideo(v)));
  await supabase
    .from("exercise_videos")
    .delete()
    .in(
      "id",
      unused.map((v) => v.id),
    );
}

/** Create or update an exercise's details. Clips upload separately. */
export async function saveExercise(input: ExerciseInput): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const name = (input.name ?? "").trim();
  if (!name) return { error: "Give it a name." };

  let kind: ExerciseKind = input.kind === "warmup" ? "warmup" : "exercise";
  if (input.id) {
    // The kind is fixed once saved: switching would break workouts that use it.
    const { data: existing } = await supabase
      .from("exercises")
      .select("kind")
      .eq("id", input.id)
      .maybeSingle();
    if (!existing) return { error: "This exercise no longer exists." };
    kind = existing.kind as ExerciseKind;
  }

  const sided = kind === "exercise" && !!input.sided;
  const equipment = EQUIPMENT_OPTIONS.map((o) => o.id as string).filter((id) =>
    input.equipment?.includes(id),
  );
  const fields = {
    kind,
    name,
    sided,
    timed_only: kind === "exercise" && !!input.timedOnly,
    equipment,
    dumbbell_levels: equipment.includes("dumbbells")
      ? DUMBBELL_LEVELS.map((l) => l.id as string).filter((id) => input.dumbbellLevels?.includes(id))
      : [],
    updated_at: new Date().toISOString(),
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("exercises").update(fields).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("exercises").insert(fields).select("id").single();
    if (error || !data) return { error: error?.message ?? "Couldn't save it." };
    id = data.id as string;
  }

  await syncTags(supabase, id, input.tagIds);

  if (input.id) {
    const { data: loops } = await supabase
      .from("exercise_videos")
      .select("id, role")
      .eq("exercise_id", id);
    await Promise.all(
      (loops ?? [])
        .filter((v) => isLoopRole(v.role as VideoRole) && v.id in (input.reps ?? {}))
        .map((v) =>
          supabase
            .from("exercise_videos")
            .update({ reps_in_clip: cleanReps(input.reps[v.id]) })
            .eq("id", v.id),
        ),
    );
    await removeUnusedClips(supabase, id, kind, sided);
  }

  revalidateExercises(id);
  return { id };
}

/**
 * Start uploading one clip: records it, then mints a Mux Direct Upload the
 * browser streams the file to (UpChunk). The asset gets the MP4 renditions the
 * player needs. A replacement is simply a newer clip for the same slot; the old
 * one stays live until the new one is ready.
 */
export async function startExerciseVideoUpload(args: {
  exerciseId: string;
  role: VideoRole;
  filename: string;
  repsInClip: number | null;
}): Promise<{ videoId?: string; url?: string; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: exercise } = await supabase
    .from("exercises")
    .select("id, kind, name")
    .eq("id", args.exerciseId)
    .maybeSingle();
  if (!exercise) return { error: "Save the exercise first." };
  const allowed: VideoRole[] =
    exercise.kind === "warmup" ? ["warmup"] : ["tutorial", "loop", "loop_right", "loop_left"];
  if (!allowed.includes(args.role)) return { error: "That clip doesn't belong on this exercise." };

  const { data: row, error } = await supabase
    .from("exercise_videos")
    .insert({
      exercise_id: exercise.id,
      role: args.role,
      status: "uploading",
      reps_in_clip: isLoopRole(args.role) ? cleanReps(args.repsInClip) : null,
      original_filename: (args.filename ?? "").slice(0, 200) || null,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Couldn't start the upload." };

  try {
    const upload = await mux.video.uploads.create({
      cors_origin: await requestOrigin(),
      new_asset_settings: {
        playback_policies: ["public"],
        static_renditions: [...EXERCISE_STATIC_RENDITIONS],
        meta: { title: `${exercise.name} — ${ROLE_LABELS[args.role]}` },
        passthrough: `exercise-video:${row.id}`,
      },
    });
    if (!upload.url) throw new Error("Mux did not return an upload URL.");
    await supabase.from("exercise_videos").update({ mux_upload_id: upload.id }).eq("id", row.id);
    return { videoId: row.id as string, url: upload.url };
  } catch (e) {
    await supabase.from("exercise_videos").delete().eq("id", row.id);
    return { error: e instanceof Error ? `Mux upload setup failed: ${e.message}` : "Mux upload setup failed." };
  }
}

/** Called when the browser has sent the whole file; Mux takes it from here. */
export async function finishExerciseVideoUpload(videoId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("exercise_videos")
    .update({ status: "processing" })
    .eq("id", videoId)
    .eq("status", "uploading")
    .select("exercise_id")
    .maybeSingle();
  if (row) {
    await syncPendingVideos(supabase, row.exercise_id as string);
    revalidateExercises(row.exercise_id as string);
  }
}

/** Check Mux for this exercise's clips that aren't ready yet. */
export async function refreshExerciseVideos(exerciseId: string): Promise<void> {
  await requireAdmin();
  await syncPendingVideos(createAdminClient(), exerciseId);
}

/** Cancel an upload in progress, or clear one that failed. */
export async function discardExerciseVideo(videoId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("exercise_videos")
    .select("id, exercise_id, mux_asset_id, mux_upload_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!row) return;
  await deleteMuxVideo(row);
  await supabase.from("exercise_videos").delete().eq("id", videoId);
  revalidateExercises(row.exercise_id as string);
}

/** Archive: hidden from the library and builder search; existing workouts keep it. */
export async function setExerciseArchived(id: string, archived: boolean): Promise<void> {
  await requireAdmin();
  await createAdminClient()
    .from("exercises")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  revalidateExercises(id);
}

/**
 * Delete an exercise, its clips and their Mux assets.
 * TODO(Phase 4.5 step 3): refuse while any workout uses it — archive instead.
 */
export async function deleteExercise(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: videos } = await supabase
    .from("exercise_videos")
    .select("mux_asset_id, mux_upload_id")
    .eq("exercise_id", id);
  await Promise.all((videos ?? []).map((v) => deleteMuxVideo(v)));
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateExercises();
  return {};
}

// ── Exercise tags ─────────────────────────────────────

function duplicateTag(message: string | undefined): boolean {
  return !!message && /duplicate|unique/i.test(message);
}

export async function createExerciseTag(name: string): Promise<{ tag?: ExerciseTag; error?: string }> {
  await requireAdmin();
  const clean = (name ?? "").trim().slice(0, 40);
  if (!clean) return { error: "Type a name." };
  const supabase = createAdminClient();
  const { data: last } = await supabase
    .from("exercise_tags")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const { data, error } = await supabase
    .from("exercise_tags")
    .insert({ name: clean, position: ((last?.[0]?.position as number | undefined) ?? -1) + 1 })
    .select("id, name")
    .single();
  if (error || !data) {
    return { error: duplicateTag(error?.message) ? "That tag already exists." : (error?.message ?? "Couldn't add it.") };
  }
  revalidateExercises();
  return { tag: { id: data.id as string, name: data.name as string, count: 0 } };
}

export async function renameExerciseTag(id: string, name: string): Promise<{ error?: string }> {
  await requireAdmin();
  const clean = (name ?? "").trim().slice(0, 40);
  if (!clean) return { error: "Type a name." };
  const { error } = await createAdminClient().from("exercise_tags").update({ name: clean }).eq("id", id);
  if (error) return { error: duplicateTag(error.message) ? "That tag already exists." : error.message };
  revalidateExercises();
  return {};
}

/** Deletes the tag and takes it off every exercise; the exercises are unchanged. */
export async function deleteExerciseTag(id: string): Promise<void> {
  await requireAdmin();
  await createAdminClient().from("exercise_tags").delete().eq("id", id);
  revalidateExercises();
}
