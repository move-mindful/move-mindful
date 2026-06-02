import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminTag {
  id: string;
  name: string;
  slug: string;
  groupId: string | null;
  position: number;
}

export interface AdminTagGroup {
  id: string;
  name: string;
  slug: string;
  position: number;
  tags: AdminTag[];
}

export interface TagPickerData {
  groups: AdminTagGroup[];
  ungrouped: AdminTag[];
}

/** Tag groups (with their tags) + ungrouped tags, for the class form pickers. */
export async function getTagPickerData(): Promise<TagPickerData> {
  const supabase = createAdminClient();
  const [{ data: groups }, { data: tags }] = await Promise.all([
    supabase.from("tag_groups").select("*").order("position"),
    supabase.from("tags").select("*").order("position"),
  ]);

  const allTags: AdminTag[] = (tags ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    groupId: t.group_id,
    position: t.position,
  }));

  const groupList: AdminTagGroup[] = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    position: g.position,
    tags: allTags.filter((t) => t.groupId === g.id),
  }));

  return {
    groups: groupList,
    ungrouped: allTags.filter((t) => t.groupId === null),
  };
}

export interface AdminClassRow {
  id: string;
  title: string;
  instructorName: string;
  durationMinutes: number;
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  publishedAt: string | null;
  inCollection: boolean;
}

/** All classes (drafts included) for the admin list, with a manual-collection flag. */
export async function getAdminClasses(): Promise<AdminClassRow[]> {
  const supabase = createAdminClient();
  const [{ data: classes }, { data: memberships }] = await Promise.all([
    supabase.from("classes").select("*").order("created_at", { ascending: false }),
    supabase.from("collection_classes").select("class_id"),
  ]);

  const inCollection = new Set((memberships ?? []).map((m) => m.class_id));

  return (classes ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    instructorName: c.instructor_name,
    durationMinutes: c.duration_minutes,
    muxPlaybackId: c.mux_playback_id,
    muxAssetId: c.mux_asset_id,
    publishedAt: c.published_at,
    inCollection: inCollection.has(c.id),
  }));
}

export interface AdminClassDetail {
  id: string;
  title: string;
  instructorName: string;
  description: string;
  durationMinutes: number;
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  publishedAt: string | null;
  tagIds: string[];
}

/** A single class with its tag ids, for the edit form. */
export async function getAdminClass(id: string): Promise<AdminClassDetail | null> {
  const supabase = createAdminClient();
  const { data: c } = await supabase.from("classes").select("*").eq("id", id).single();
  if (!c) return null;

  const { data: ct } = await supabase
    .from("class_tags")
    .select("tag_id")
    .eq("class_id", id);

  return {
    id: c.id,
    title: c.title,
    instructorName: c.instructor_name,
    description: c.description ?? "",
    durationMinutes: c.duration_minutes,
    muxPlaybackId: c.mux_playback_id,
    muxAssetId: c.mux_asset_id,
    publishedAt: c.published_at,
    tagIds: (ct ?? []).map((r) => r.tag_id),
  };
}
