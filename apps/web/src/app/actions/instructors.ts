"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type AdminClient = ReturnType<typeof createAdminClient>;

const BUCKET = "instructor-avatars";

// Revalidate everywhere an instructor name/photo is shown.
function revalidateInstructorSurfaces() {
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/classes");
  revalidatePath("/classes");
}

/** Upload an avatar file to Storage and return its public URL (or null). */
async function uploadAvatar(supabase: AdminClient, file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = (file.name.split(".").pop() || "webp").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext || "webp"}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/webp", upsert: false });
  if (error) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort removal of a previously stored avatar, given its public URL. */
async function removeAvatar(supabase: AdminClient, url: string | null) {
  if (!url) return;
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export async function createInstructor(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!name) return;

  const avatarUrl = await uploadAvatar(supabase, formData.get("avatar") as File | null);
  await supabase.from("instructors").insert({ name, avatar_url: avatarUrl });
  revalidateInstructorSurfaces();
}

export async function updateInstructor(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!id || !name) return;

  const update: { name: string; avatar_url?: string } = { name };

  const file = formData.get("avatar") as File | null;
  if (file && file.size > 0) {
    const newUrl = await uploadAvatar(supabase, file);
    if (newUrl) {
      const { data: existing } = await supabase
        .from("instructors")
        .select("avatar_url")
        .eq("id", id)
        .single();
      update.avatar_url = newUrl;
      await removeAvatar(supabase, existing?.avatar_url ?? null);
    }
  }

  await supabase.from("instructors").update(update).eq("id", id);
  revalidateInstructorSurfaces();
}

export async function deleteInstructor(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  if (!id) return;

  const { data: existing } = await supabase
    .from("instructors")
    .select("avatar_url")
    .eq("id", id)
    .single();

  // classes.instructor_id has ON DELETE SET NULL → classes are unassigned, not deleted.
  await supabase.from("instructors").delete().eq("id", id);
  await removeAvatar(supabase, existing?.avatar_url ?? null);

  revalidateInstructorSurfaces();
}
