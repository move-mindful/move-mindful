"use server";

import { revalidatePath } from "next/cache";
import type { WorkoutBlock } from "@move-mindful/core";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanBlocks, type ExerciseInfo } from "@/lib/workouts/clean";
import { generateWorkoutDraft, setGeneratorInstructions } from "@/lib/workouts/generate";
import { getCatalog, getWorkout } from "@/lib/workouts/server";
import {
  LEVELS,
  publishProblems,
  type GenerateCriteria,
  type GenerateResult,
  type WorkoutInput,
} from "@/lib/workouts/shared";

// save_workout_sequence (011_workout_set_rest_and_cover.sql) takes an exercise
// block flat — { kind, exerciseId, measure, amount, firstSide, sets,
// restBetweenSets } — rather than with the exercise nested under `move`.
// Rests and groups already match its shape.
function toSequencePayload(blocks: WorkoutBlock[]) {
  return blocks.map((b) =>
    b.kind === "exercise" ? { kind: b.kind, ...b.move, sets: b.sets, restBetweenSets: b.restBetweenSets } : b,
  );
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
  const { data: rows } = ids.size
    ? await supabase.from("exercises").select("id, kind, timed_only").in("id", [...ids].filter(Boolean))
    : { data: [] };
  const info = new Map<string, ExerciseInfo>((rows ?? []).map((r) => [r.id as string, r as ExerciseInfo]));
  const warmup = input.warmupExerciseId && info.get(input.warmupExerciseId)?.kind === "warmup" ? input.warmupExerciseId : null;

  const fields = {
    title,
    description: (input.description ?? "").trim().slice(0, 2000),
    level: LEVELS.some((l) => l.id === input.level) ? input.level : null,
    instructor_id: input.instructorId || null,
    updated_at: new Date().toISOString(),
  };

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("workouts").update(fields).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("workouts").insert(fields).select("id").single();
    if (error || !data) return { error: error?.message ?? "Couldn't save the workout." };
    id = data.id as string;
  }

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
  const { data: existing } = await supabase.from("workouts").select("cover_image_url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) return { error: error.message };
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
