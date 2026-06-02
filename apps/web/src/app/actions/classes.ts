"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { mux } from "@/lib/mux/client";
import type { ClassFormState } from "@/lib/admin/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type AdminClient = ReturnType<typeof createAdminClient>;

function parseFields(formData: FormData) {
  return {
    title: ((formData.get("title") as string) ?? "").trim(),
    instructorName: ((formData.get("instructorName") as string) ?? "").trim(),
    description: ((formData.get("description") as string) ?? "").trim(),
    durationMinutes: Number(formData.get("durationMinutes")),
    muxPlaybackId: ((formData.get("muxPlaybackId") as string) ?? "").trim(),
    muxAssetId: ((formData.get("muxAssetId") as string) ?? "").trim() || null,
  };
}

// Discipline + Intensity are single-select (one each); other groups are multi-select.
// The disciplineTagId/intensityTagId fields structurally enforce the §14 "≤1 each" rule.
function parseTagSelections(formData: FormData) {
  const disciplineTagId = ((formData.get("disciplineTagId") as string) || "").trim();
  const intensityTagId = ((formData.get("intensityTagId") as string) || "").trim();
  const otherTagIds = formData.getAll("tagIds").map(String).filter(Boolean);
  const tagIds = [disciplineTagId, intensityTagId, ...otherTagIds].filter(Boolean);
  return { disciplineTagId, intensityTagId, tagIds };
}

async function syncClassTags(supabase: AdminClient, classId: string, tagIds: string[]) {
  await supabase.from("class_tags").delete().eq("class_id", classId);
  if (tagIds.length > 0) {
    await supabase
      .from("class_tags")
      .insert(tagIds.map((tag_id) => ({ class_id: classId, tag_id })));
  }
}

function validate(f: ReturnType<typeof parseFields>): string | null {
  if (!f.title) return "Title is required.";
  if (!f.durationMinutes || f.durationMinutes <= 0)
    return "Duration must be a positive number of minutes.";
  if (!f.muxPlaybackId) return "A Mux playback ID is required.";
  return null;
}

export async function createClass(
  _prev: ClassFormState,
  formData: FormData,
): Promise<ClassFormState> {
  await requireAdmin();
  const supabase = createAdminClient();
  const f = parseFields(formData);
  const invalid = validate(f);
  if (invalid) return { error: invalid };

  const { tagIds } = parseTagSelections(formData);

  const { data: created, error } = await supabase
    .from("classes")
    .insert({
      title: f.title,
      instructor_name: f.instructorName,
      description: f.description,
      duration_minutes: f.durationMinutes,
      mux_playback_id: f.muxPlaybackId,
      mux_asset_id: f.muxAssetId,
      // published_at left null → draft
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Failed to create class." };
  await syncClassTags(supabase, created.id, tagIds);

  revalidatePath("/admin/classes");
  redirect("/admin/classes");
}

export async function updateClass(
  _prev: ClassFormState,
  formData: FormData,
): Promise<ClassFormState> {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  if (!id) return { error: "Missing class id." };

  const f = parseFields(formData);
  const invalid = validate(f);
  if (invalid) return { error: invalid };

  const { tagIds } = parseTagSelections(formData);

  const { error } = await supabase
    .from("classes")
    .update({
      title: f.title,
      instructor_name: f.instructorName,
      description: f.description,
      duration_minutes: f.durationMinutes,
      mux_playback_id: f.muxPlaybackId,
      mux_asset_id: f.muxAssetId,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  await syncClassTags(supabase, id, tagIds);

  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${id}`);
  redirect("/admin/classes");
}

export async function setClassPublished(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const publish = formData.get("publish") === "true";

  await supabase
    .from("classes")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);

  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${id}`);
  revalidatePath("/classes");
}

export async function deleteClass(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const alsoDeleteFromMux = formData.get("deleteFromMux") === "on";

  const { data: cls } = await supabase
    .from("classes")
    .select("mux_asset_id")
    .eq("id", id)
    .single();

  // Cascades remove class_tags + collection_classes rows.
  await supabase.from("classes").delete().eq("id", id);

  if (alsoDeleteFromMux && cls?.mux_asset_id) {
    try {
      await mux.video.assets.delete(cls.mux_asset_id);
    } catch {
      // Asset may already be gone in Mux; removing the catalog row is what matters.
    }
  }

  revalidatePath("/admin/classes");
  revalidatePath("/classes");
  redirect("/admin/classes");
}
