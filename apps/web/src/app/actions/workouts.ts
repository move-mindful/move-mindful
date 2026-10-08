"use server";

import { revalidatePath } from "next/cache";
import { allTips, type AudioTip, type TipMap, type WorkoutBlock } from "@move-mindful/core";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mux } from "@/lib/mux/client";
import { requestOrigin } from "@/lib/mux/request-origin";
import { EXERCISE_STATIC_RENDITIONS, WORKOUT_CLIPS, deleteMuxVideo, syncPendingClips } from "@/lib/exercises/server";
import { cleanBlocks, readTip, type ExerciseInfo } from "@/lib/workouts/clean";
import { generateWorkoutDraft, setGeneratorInstructions } from "@/lib/workouts/generate";
import { getCatalog, getWorkout, getWorkoutVideoRows, toWorkoutVideo } from "@/lib/workouts/server";
import {
  LEVELS,
  TIP_BUCKET,
  RUNDOWN_TIP_MAX_SECONDS,
  TIP_MAX_SECONDS,
  publishProblems,
  type GenerateCriteria,
  type GenerateResult,
  type WorkoutInput,
  type WorkoutVideo,
  type WorkoutVideoRole,
} from "@/lib/workouts/shared";

type AdminClient = ReturnType<typeof createAdminClient>;

// save_workout_sequence (021_rest_between_sides.sql) takes an exercise block
// flat — { kind, exerciseId, measure, amount, firstSide, restBetweenSides,
// sets, restBetweenSets } — rather than with the exercise nested under `move`,
// and each row's audio tips as its `tips` column holds them: { sets, rests }.
// Before 019 has run, the old function ignores `tips`; before 021, it ignores
// `restBetweenSides` (see sideRestsSave).
function rowTips(sets: TipMap | undefined, rests: TipMap | undefined) {
  return sets || rests ? { ...(sets && { sets }), ...(rests && { rests }) } : null;
}

function toSequencePayload(blocks: WorkoutBlock[]) {
  return blocks.map((b) => {
    if (b.kind === "exercise") {
      const { tips, ...move } = b.move;
      return { kind: b.kind, ...move, sets: b.sets, restBetweenSets: b.restBetweenSets, tips: rowTips(tips, b.restTips) };
    }
    if (b.kind === "group") {
      const { restTips, moves, ...group } = b;
      return { ...group, moves: moves.map(({ tips, ...m }) => ({ ...m, tips: rowTips(tips, undefined) })), tips: rowTips(undefined, restTips) };
    }
    return { kind: b.kind, seconds: b.seconds, tips: rowTips(undefined, b.restTips) };
  });
}

// Before 018_intro_outro_cooldown.sql has run, PostgREST rejects the unknown
// cooldown_exercise_id column (PGRST204); a workout without a cool-down still saves.
function missingCooldownColumn(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "PGRST204" && !!error.message?.includes("cooldown");
}

/**
 * Whether a rest between sides will save: before 021_rest_between_sides.sql
 * has run, the old save function drops it without a word, so the column is
 * checked first (42703: no such column).
 */
async function sideRestsSave(supabase: AdminClient): Promise<boolean> {
  const { error } = await supabase.from("workout_blocks").select("rest_between_sides").limit(1);
  return error?.code !== "42703";
}

// Before 022_workout_overview_tip.sql has run, PostgREST rejects the unknown
// rundown_tip column (PGRST204); a workout without that tip still saves.
function missingRundownColumn(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "PGRST204" && !!error.message?.includes("rundown_tip");
}

/** Saving "All levels" before 020_workout_level_all.sql: the old level check turns it away. */
function missingAllLevels(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "23514" && !!error.message?.includes("workouts_level_check");
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
  let sideRests = false;
  for (const b of input.blocks ?? []) {
    const moves = b?.kind === "exercise" ? [b.move] : b?.kind === "group" ? (b.moves ?? []) : [];
    for (const m of moves) {
      ids.add(m?.exerciseId);
      if (Number(m?.restBetweenSides) > 0) sideRests = true;
    }
  }
  if (sideRests && !(await sideRestsSave(supabase))) {
    return { error: "Rest between sides can’t be saved until migration 021_rest_between_sides.sql has run." };
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

  // The workout overview's tip: only ever this workout's own recording (a new
  // workout has none yet — recording one saves it first), its cues only for
  // real exercises.
  const rundownTip = input.id ? (readTip(input.rundownTip, input.id) ?? null) : null;
  if (rundownTip?.cues) {
    const cues = rundownTip.cues.filter((c) => info.get(c.exerciseId)?.kind === "exercise");
    if (cues.length) rundownTip.cues = cues;
    else delete rundownTip.cues;
  }

  const fields: Record<string, unknown> = {
    title,
    description: (input.description ?? "").trim().slice(0, 2000),
    level: LEVELS.some((l) => l.id === input.level) ? input.level : null,
    instructor_id: input.instructorId || null,
    cooldown_exercise_id: cooldown,
    rundown_tip: rundownTip,
    updated_at: new Date().toISOString(),
  };

  let written = await writeWorkout(supabase, input.id, fields);
  if (missingCooldownColumn(written.error)) {
    // No cool-down can be picked before the migration (none exist yet), so this is a plain save.
    if (cooldown) return { error: "The cool-down can’t be saved until migration 018_intro_outro_cooldown.sql has run." };
    delete fields.cooldown_exercise_id;
    written = await writeWorkout(supabase, input.id, fields);
  }
  if (missingRundownColumn(written.error)) {
    if (rundownTip) return { error: "The workout overview’s tip can’t be saved until migration 022_workout_overview_tip.sql has run." };
    delete fields.rundown_tip;
    written = await writeWorkout(supabase, input.id, fields);
  }
  if (missingAllLevels(written.error) && fields.level === "all_levels") {
    return { error: "“All levels” can’t be saved until migration 020_workout_level_all.sql has run." };
  }
  if (written.error || !written.id) return { error: written.error?.message ?? "Couldn't save the workout." };
  const id = written.id;

  const blocks = cleanBlocks(input.blocks, info, { tipFolder: id });
  const { error } = await supabase.rpc("save_workout_sequence", {
    p_workout_id: id,
    p_warmup_exercise_id: warmup,
    p_blocks: toSequencePayload(blocks),
  });
  if (error) return { id, error: `The sequence didn't save: ${error.message}` };
  // Recordings the saved sequence (and the workout overview) no longer use — redone, removed, or never saved — go.
  const kept = [...allTips(blocks), ...(rundownTip ? [rundownTip] : [])];
  await removeTipFiles(supabase, id, new Set(kept.map((t) => t.id)));

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
  await removeTipFiles(supabase, id, new Set(), true);
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

// ── Audio tips ────────────────────────────────────────
// The instructor's recordings for sets and rests, made in the builder's
// "Audio tips" view (019_workout_audio_tips.sql). Each one is uploaded as soon
// as it's recorded; the sequence only points at it once the workout is saved,
// and saving clears out the files it doesn't point at.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete this workout's tip files except `keep`. Saving passes what the saved
 * sequence uses, and leaves anything from the last hour: a recording still on
 * its way to the builder when Save was pressed isn't in the sequence yet.
 * Deleting the workout passes `everything`.
 */
async function removeTipFiles(supabase: AdminClient, workoutId: string, keep: Set<string>, everything = false) {
  // Before 019 has run there's no bucket: nothing to clear.
  const { data: files, error } = await supabase.storage.from(TIP_BUCKET).list(workoutId, { limit: 1000 });
  if (error || !files?.length) return;
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const stale = files
    .filter((f) => everything || !f.created_at || Date.parse(f.created_at) < hourAgo)
    .map((f) => `${workoutId}/${f.name}`)
    .filter((path) => !keep.has(path));
  if (stale.length) await supabase.storage.from(TIP_BUCKET).remove(stale);
}

/**
 * Store one recording (form fields `workoutId`, `seconds`, `audio` — AAC in
 * an MP4 container, as Chrome and Safari record it — and `overview` for the
 * workout overview's, which can run longer). Returns the tip to put in a
 * slot; it's kept once the workout is saved with it.
 */
export async function uploadWorkoutTip(formData: FormData): Promise<{ tip?: AudioTip; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();
  const workoutId = String(formData.get("workoutId") ?? "");
  const audio = formData.get("audio") as File | null;
  const seconds = Number(formData.get("seconds"));
  if (!UUID.test(workoutId)) return { error: "Save the workout first." };
  if (!audio || audio.size === 0 || !Number.isFinite(seconds) || seconds <= 0) return { error: "Nothing was recorded." };
  // Three minutes of AAC at 128 kb/s is under 3 MB.
  const max = formData.get("overview") === "1" ? RUNDOWN_TIP_MAX_SECONDS : TIP_MAX_SECONDS;
  if (audio.size > 4_000_000 || seconds > max + 5) return { error: "That recording is too long." };

  const { data: workout } = await supabase.from("workouts").select("id").eq("id", workoutId).maybeSingle();
  if (!workout) return { error: "Save the workout first." };

  const id = `${workoutId}/${crypto.randomUUID()}.m4a`;
  const { error } = await supabase.storage
    .from(TIP_BUCKET)
    // A new name every time, so it can be cached for good.
    .upload(id, audio, { contentType: "audio/mp4", cacheControl: "31536000", upsert: false });
  if (error) {
    return {
      error: /bucket not found/i.test(error.message)
        ? "Audio tips can’t be saved until migration 019_workout_audio_tips.sql has run."
        : `Upload failed: ${error.message}`,
    };
  }
  return { tip: { id, seconds: Math.round(seconds * 10) / 10 } };
}
