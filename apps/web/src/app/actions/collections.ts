"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type AdminClient = ReturnType<typeof createAdminClient>;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueCollectionSlug(supabase: AdminClient, base: string): Promise<string> {
  const baseSlug = base || "collection";
  const { data } = await supabase
    .from("collections")
    .select("slug")
    .like("slug", `${baseSlug}%`);
  const existing = new Set((data ?? []).map((r) => r.slug));
  if (!existing.has(baseSlug)) return baseSlug;
  let i = 2;
  while (existing.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

function revalidateCollections(id?: string) {
  revalidatePath("/admin/collections");
  if (id) revalidatePath(`/admin/collections/${id}`);
  revalidatePath("/classes");
}

export async function createCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const title = ((formData.get("title") as string) ?? "").trim();
  const kind = (formData.get("kind") as string) === "smart" ? "smart" : "manual";
  if (!title) return;
  const slug = await uniqueCollectionSlug(supabase, slugify(title));
  const { data: maxRow } = await supabase
    .from("collections")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const position = ((maxRow?.[0]?.position ?? -1) as number) + 1;
  const { data, error } = await supabase
    .from("collections")
    .insert({ title, slug, kind, position })
    .select("id")
    .single();
  if (error || !data) return;
  revalidateCollections();
  redirect(`/admin/collections/${data.id}`);
}

export async function updateCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const title = ((formData.get("title") as string) ?? "").trim();
  const description = ((formData.get("description") as string) ?? "").trim();
  const matchMode = (formData.get("matchMode") as string) === "all" ? "all" : "any";
  if (!id || !title) return;
  await supabase
    .from("collections")
    .update({ title, description, match_mode: matchMode })
    .eq("id", id);
  revalidateCollections(id);
}

export async function setCollectionPublished(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const publish = formData.get("publish") === "true";
  await supabase
    .from("collections")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", id);
  revalidateCollections(id);
}

export async function deleteCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  if (!id) return;
  // Cascades remove collection_classes + collection_rule_tags. Classes are untouched.
  await supabase.from("collections").delete().eq("id", id);
  revalidateCollections();
  redirect("/admin/collections");
}

export async function moveCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const id = (formData.get("id") as string) || "";
  const direction = (formData.get("direction") as string) === "up" ? "up" : "down";
  const { data: cols } = await supabase.from("collections").select("id,position").order("position");
  const items = cols ?? [];
  const idx = items.findIndex((c) => c.id === id);
  if (idx < 0) return;
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= items.length) return;
  const a = items[idx];
  const b = items[j];
  await supabase.from("collections").update({ position: b.position }).eq("id", a.id);
  await supabase.from("collections").update({ position: a.position }).eq("id", b.id);
  revalidateCollections();
}

export async function addClassToCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const collectionId = (formData.get("collectionId") as string) || "";
  const classId = (formData.get("classId") as string) || "";
  if (!collectionId || !classId) return;
  // §14: only manual collections have explicit members.
  const { data: col } = await supabase
    .from("collections")
    .select("kind")
    .eq("id", collectionId)
    .single();
  if (col?.kind !== "manual") return;
  const { data: maxRow } = await supabase
    .from("collection_classes")
    .select("position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: false })
    .limit(1);
  const position = ((maxRow?.[0]?.position ?? -1) as number) + 1;
  await supabase
    .from("collection_classes")
    .insert({ collection_id: collectionId, class_id: classId, position });
  revalidateCollections(collectionId);
}

export async function removeClassFromCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const collectionId = (formData.get("collectionId") as string) || "";
  const classId = (formData.get("classId") as string) || "";
  if (!collectionId || !classId) return;
  await supabase
    .from("collection_classes")
    .delete()
    .eq("collection_id", collectionId)
    .eq("class_id", classId);
  revalidateCollections(collectionId);
}

export async function moveClassInCollection(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const collectionId = (formData.get("collectionId") as string) || "";
  const classId = (formData.get("classId") as string) || "";
  const direction = (formData.get("direction") as string) === "up" ? "up" : "down";
  if (!collectionId || !classId) return;
  const { data: members } = await supabase
    .from("collection_classes")
    .select("class_id,position")
    .eq("collection_id", collectionId)
    .order("position");
  const items = members ?? [];
  const idx = items.findIndex((m) => m.class_id === classId);
  if (idx < 0) return;
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= items.length) return;
  const a = items[idx];
  const b = items[j];
  await supabase
    .from("collection_classes")
    .update({ position: b.position })
    .eq("collection_id", collectionId)
    .eq("class_id", a.class_id);
  await supabase
    .from("collection_classes")
    .update({ position: a.position })
    .eq("collection_id", collectionId)
    .eq("class_id", b.class_id);
  revalidateCollections(collectionId);
}

export async function setCollectionRuleTags(formData: FormData) {
  await requireAdmin();
  const supabase = createAdminClient();
  const collectionId = (formData.get("collectionId") as string) || "";
  if (!collectionId) return;
  // §14: only smart collections have rule tags.
  const { data: col } = await supabase
    .from("collections")
    .select("kind")
    .eq("id", collectionId)
    .single();
  if (col?.kind !== "smart") return;
  const tagIds = formData.getAll("tagIds").map(String).filter(Boolean);
  await supabase.from("collection_rule_tags").delete().eq("collection_id", collectionId);
  if (tagIds.length > 0) {
    await supabase
      .from("collection_rule_tags")
      .insert(tagIds.map((tag_id) => ({ collection_id: collectionId, tag_id })));
  }
  revalidateCollections(collectionId);
}
