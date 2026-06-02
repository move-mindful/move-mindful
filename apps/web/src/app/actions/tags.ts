"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type AdminClient = ReturnType<typeof createAdminClient>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(
  supabase: AdminClient,
  table: "tags" | "tag_groups",
  base: string,
): Promise<string> {
  const baseSlug = base || (table === "tags" ? "tag" : "group");
  const { data } = await supabase.from(table).select("slug").like("slug", `${baseSlug}%`);
  const existing = new Set((data ?? []).map((r) => r.slug));
  if (!existing.has(baseSlug)) return baseSlug;
  let i = 2;
  while (existing.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

async function nextPosition(supabase: AdminClient, table: "tags" | "tag_groups"): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  return ((data?.[0]?.position ?? -1) as number) + 1;
}

export async function createTagGroup(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!name) return;
  const slug = await uniqueSlug(supabase, "tag_groups", slugify(name));
  const position = await nextPosition(supabase, "tag_groups");
  await supabase.from("tag_groups").insert({ name, slug, position });
  revalidatePath("/admin/tags");
}

export async function updateTagGroup(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!id || !name) return;
  await supabase.from("tag_groups").update({ name }).eq("id", id);
  revalidatePath("/admin/tags");
}

export async function deleteTagGroup(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  if (!id) return;
  // tags.group_id has ON DELETE SET NULL → its tags become ungrouped, not deleted.
  await supabase.from("tag_groups").delete().eq("id", id);
  revalidatePath("/admin/tags");
}

export async function createTag(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const name = ((formData.get("name") as string) ?? "").trim();
  const groupId = ((formData.get("groupId") as string) ?? "").trim() || null;
  if (!name) return;
  const slug = await uniqueSlug(supabase, "tags", slugify(name));
  const position = await nextPosition(supabase, "tags");
  await supabase.from("tags").insert({ name, slug, group_id: groupId, position });
  revalidatePath("/admin/tags");
}

export async function updateTag(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!id || !name) return;
  await supabase.from("tags").update({ name }).eq("id", id);
  revalidatePath("/admin/tags");
}

export async function deleteTag(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  if (!id) return;
  // class_tags + collection_rule_tags cascade on delete.
  await supabase.from("tags").delete().eq("id", id);
  revalidatePath("/admin/tags");
  revalidatePath("/admin/classes");
}
