"use server";

import { revalidatePath } from "next/cache";
import type { WorkoutBlock } from "@move-mindful/core";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mux } from "@/lib/mux/client";
import { requestOrigin } from "@/lib/mux/request-origin";
import { EXERCISE_STATIC_RENDITIONS, WORKOUT_CLIPS, deleteMuxVideo, syncPendingClips } from "@/lib/exercises/server";
import { cleanBlocks, type ExerciseInfo } from "@/lib/workouts/clean";
import { generateWorkoutDraft, setGeneratorInstructions } from "@/lib/workouts/generate";
import { getCatalog, getWorkout, getWorkoutVideoRows, toWorkoutVideo } from "@/lib/workouts/server";
import {
  LEVELS,
  publishProblems,
  type GenerateCriteria,
  type GenerateResult,
  type WorkoutInput,
  type WorkoutVideo,
  type WorkoutVideoRole,
} from "@/lib/workouts/shared";

type AdminClient = ReturnType<typeof createAdminClient>;

// save_workout_sequence (011_workout_set_rest_and_cover.sql) takes an exercise
// block flat — { kind, exerciseId, measure, amount, firstSide, sets,
// restBetweenSets } — rather than with the exercise nested under `move`.
// Rests and groups already match its shape.
function toSequencePayload(blocks: WorkoutBlock[]) {
  return blocks.map((b) =>
    b.kind === "exercise" ? { kind: b.kind, ...b.move, sets: b.sets, restBetweenSets: b.restBetweenSets } : b,
  );
}

// Before 018_intro_outro_cooldown.sql has run, PostgREST rejects the unknown
// cooldown_exercise_id column (PGRST204); a workout without a cool-down still saves.
function missingCooldownColumn(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "PGRST204" && !!error.message?.includes("cooldown");
}

async function writeWorkout(
  supabase: AdminClient,
  id: string | undefined,
  fields: Record<string, unknown>,
): Promise<{ id?: string; error: { code?: string; message: string } | null }> {
  if (id) {
    const { error } = await supabase.from("workouts").update(fields).eq("id", id);
    return { id, error };
  }
  const { data, error } = await supabase.from("workouts").insert(fields).select("id").single();
  return { id: data?.id as string | undefined, error: error ?? (data ? null : { message: "Couldn't save the workout." }) };
}

function revalidateWorkouts(id?: string) {
  revalidatePath("/admin/workouts");
  revalidatePath("/admin/exercises");
  if (id) revalidatePath(`/admin/workouts/${id}`);
}

/** Create or update a workout: its details plus the whole sequence, saved atomically. */
export async function saveWorkout(input: WorkoutInput): Promise<{ id?: string; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const title = (input.title ?? "").trim().slice(0, 120);
  if (!title) return { error: "Give the workout a title." };

  const ids = new Set<string>();
  for (const b of input.blocks ?? []) {
    if (b?.kind === "exercise") ids.add(b.move?.exerciseId);
    if (b?.kind === "group") (b.moves ?? []).forEach((m) => ids.add(m?.exerciseId));
  }
  if (input.warmupExerciseId) ids.add(input.warmupExerciseId);
  if (input.cooldownExerciseId) ids.add(input.cooldownExerciseId);
  const { data: rows } = ids.size
    ? await supabase.from("exercises").select("id, kind, timed_only").in("id", [...ids].filter(Boolean))
    : { data: [] };
  const info = new Map<string, ExerciseInfo>((rows ?? []).map((r) => [r.id as string, r as ExerciseInfo]));
  const warmup = input.warmupExerciseId && info.get(input.warmupExerciseId)?.kind === "warmup" ? input.warmupExerciseId : null;
  const cooldown =
    input.cooldownExerciseId && info.get(input.cooldownExerciseId)?.kind === "cooldown" ? input.cooldownExerciseId : null;

  const fields: Record<string, unknown> = {
    title,
    description: (input.description ?? "").trim().slice(0, 2000),
    level: LEVELS.some((l) => l.id === input.level) ? input.level : null,
    instructor_id: input.instructorId || null,
    cooldown_exercise_id: cooldown,
    updated_at: new Date().toISOString(),
  };

  let written = await writeWorkout(supabase, input.id, fields);
  if (missingCooldownColumn(written.error)) {
    // No cool-down can be picked before the migration (none exist yet), so this is a plain save.
    if (cooldown) return { error: "The cool-down can’t be saved until migration 018_intro_outro_cooldown.sql has run." };
    delete fields.cooldown_exercise_id;
    written = await writeWorkout(supabase, input.id, fields);
  }
  if (written.error || !written.id) return { error: written.error?.message ?? "Couldn't save the workout." };
  const id = written.id;

  const { error } = await supabase.rpc("save_workout_sequence", {
    p_workout_id: id,
    p_warmup_exercise_id: warmup,
    p_blocks: toSequencePayload(cleanBlocks(input.blocks, info)),
  });
  if (error) return { id, error: `The sequence didn't save: ${error.message}` };

  revalidateWorkouts(id);
  return { id };
}

/**
 * "Generate with AI" in the builder: Claude drafts a sequence from the admin's
 * criteria, the exercise library and the published workouts. Nothing is saved
 * — the builder fills in, and the admin reviews and saves it like any edit.
 * `workoutId` (the one being edited) is left out of the published examples.
 */
export async function generateWorkout(criteria: GenerateCriteria, workoutId: string | null): Promise<GenerateResult> {
  await requireAdmin();
  return generateWorkoutDraft(criteria, workoutId);
}

/** Save the instructions Claude gets in "Generate with AI" (blank or the default resets them). */
export async function saveGeneratorInstructions(text: string): Promise<{ text?: string; error?: string }> {
  await requireAdmin();
  return setGeneratorInstructions(String(text ?? ""));
}

/** Publish (after checking it's complete) or move back to draft. */
export async function setWorkoutPublished(id: string, publish: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  if (publish) {
    const [workout, catalog] = await Promise.all([getWorkout(id), getCatalog()]);
    if (!workout) return { error: "This workout no longer exists." };
    const problems = publishProblems(
      workout.blocks,
      new Map(catalog.map((c) => [c.id, c])),
      workout.warmupExerciseId,
      workout.cooldownExerciseId,
    );
    if (problems.length) return { error: problems.join(" ") };
  }
  const { error } = await createAdminClient()
    .from("workouts")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidateWorkouts(id);
  return {};
}

export async function deleteWorkout(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const [{ data: existing }, { data: videos }] = await Promise.all([
    supabase.from("workouts").select("cover_image_url").eq("id", id).maybeSingle(),
    supabase.from("workout_videos").select("mux_asset_id, mux_upload_id").eq("workout_id", id),
  ]);
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) return { error: error.message };
  // The intro and outro rows went with it; their Mux assets go too.
  await Promise.all((videos ?? []).map((v) => deleteMuxVideo(v)));
  await removeCoverFile(supabase, existing?.cover_image_url ?? null);
  revalidateWorkouts();
  return {};
}

// ── Cover image ───────────────────────────────────────
// Stored in the public `workout-covers` bucket (011_workout_set_rest_and_cover.sql),
// resized in the browser before upload.

const COVER_BUCKET = "workout-covers";

async function removeCoverFile(supabase: ReturnType<typeof createAdminClient>, url: string | null) {
  if (!url) return;
  const marker = `/${COVER_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at !== -1) await supabase.storage.from(COVER_BUCKET).remove([url.slice(at + marker.length)]);
}

/** Upload a new cover (form fields `workoutId`, `cover`), replacing any old one. */
export async function setWorkoutCover(formData: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = String(formData.get("workoutId") ?? "");
  const file = formData.get("cover") as File | null;
  if (!id || !file || file.size === 0) return { error: "Choose an image." };
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };

  const { data: existing } = await supabase.from("workouts").select("cover_image_url").eq("id", id).maybeSingle();
  if (!existing) return { error: "Save the workout first." };

  const ext = file.type === "image/webp" ? "webp" : (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${id}/${crypto.randomUUID()}.${ext || "jpg"}`;
  const { error: uploadError } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const url = supabase.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.from("workouts").update({ cover_image_url: url }).eq("id", id);
  if (error) {
    await supabase.storage.from(COVER_BUCKET).remove([path]);
    return { error: error.message };
  }
  await removeCoverFile(supabase, existing.cover_image_url);
  revalidateWorkouts(id);
  return { url };
}

export async function removeWorkoutCover(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("workouts").select("cover_image_url").eq("id", id).maybeSingle();
  await supabase.from("workouts").update({ cover_image_url: null }).eq("id", id);
  await removeCoverFile(supabase, existing?.cover_image_url ?? null);
  revalidateWorkouts(id);
}

// ── Intro and outro videos ────────────────────────────
// A workout's own clips (workout_videos, 018_intro_outro_cooldown.sql), uploaded
// from the builder the way exercise clips are: a Mux Direct Upload the browser
// streams the file to (UpChunk), then Mux makes the MP4 the player plays. A
// replacement keeps the old clip live until it's ready.

const VIDEO_ROLE_LABELS: Record<WorkoutVideoRole, string> = { intro: "Intro", outro: "Outro" };

/** Start uploading an intro or outro: records it, then mints the Mux upload. */
export async function startWorkoutVideoUpload(args: {
  workoutId: string;
  role: WorkoutVideoRole;
  filename: string;
}): Promise<{ videoId?: string; url?: string; error?: string }> {
  await requireAdmin();
  if (args.role !== "intro" && args.role !== "outro") return { error: "That video doesn't belong on a workout." };
  const supabase = createAdminClient();
  const { data: workout } = await supabase.from("workouts").select("id, title").eq("id", args.workoutId).maybeSingle();
  if (!workout) return { error: "Save the workout first." };

  const { data: row, error } = await supabase
    .from("workout_videos")
    .insert({
      workout_id: workout.id,
      role: args.role,
      status: "uploading",
      original_filename: (args.filename ?? "").slice(0, 200) || null,
    })
    .select("id")
    .single();
  if (error?.code === "PGRST205") {
    return { error: "Intro and outro videos can’t be uploaded until migration 018_intro_outro_cooldown.sql has run." };
  }
  if (error || !row) return { error: error?.message ?? "Couldn't start the upload." };

  try {
    const upload = await mux.video.uploads.create({
      cors_origin: await requestOrigin(),
      new_asset_settings: {
        playback_policies: ["public"],
        static_renditions: [...EXERCISE_STATIC_RENDITIONS],
        meta: { title: `${workout.title} — ${VIDEO_ROLE_LABELS[args.role]}` },
        passthrough: `workout-video:${row.id}`,
      },
    });
    if (!upload.url) throw new Error("Mux did not return an upload URL.");
    await supabase.from("workout_videos").update({ mux_upload_id: upload.id }).eq("id", row.id);
    return { videoId: row.id as string, url: upload.url };
  } catch (e) {
    await supabase.from("workout_videos").delete().eq("id", row.id);
    return { error: e instanceof Error ? `Mux upload setup failed: ${e.message}` : "Mux upload setup failed." };
  }
}

/** Called when the browser has sent the whole file; Mux takes it from here. */
export async function finishWorkoutVideoUpload(videoId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("workout_videos")
    .update({ status: "processing" })
    .eq("id", videoId)
    .eq("status", "uploading")
    .select("workout_id")
    .maybeSingle();
  if (row) {
    await syncPendingClips(supabase, WORKOUT_CLIPS, row.workout_id as string);
    revalidateWorkouts(row.workout_id as string);
  }
}

/** Check Mux for this workout's clips that aren't ready yet, and return them all. */
export async function refreshWorkoutVideos(workoutId: string): Promise<WorkoutVideo[]> {
  await requireAdmin();
  await syncPendingClips(createAdminClient(), WORKOUT_CLIPS, workoutId);
  return (await getWorkoutVideoRows(workoutId, false)).map(toWorkoutVideo);
}

/** Cancel an upload in progress, or clear one that failed. */
export async function discardWorkoutVideo(videoId: string): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("workout_videos")
    .select("id, workout_id, mux_asset_id, mux_upload_id")
    .eq("id", videoId)
    .maybeSingle();
  if (!row) return;
  await deleteMuxVideo(row);
  await supabase.from("workout_videos").delete().eq("id", videoId);
  revalidateWorkouts(row.workout_id as string);
}

/** Take the intro or outro off the workout: every clip for that slot, and its Mux assets. */
export async function removeWorkoutVideo(workoutId: string, role: WorkoutVideoRole): Promise<void> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("workout_videos")
    .select("id, mux_asset_id, mux_upload_id")
    .eq("workout_id", workoutId)
    .eq("role", role);
  if (!rows?.length) return;
  await Promise.all(rows.map((r) => deleteMuxVideo(r)));
  await supabase
    .from("workout_videos")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
  revalidateWorkouts(workoutId);
}
