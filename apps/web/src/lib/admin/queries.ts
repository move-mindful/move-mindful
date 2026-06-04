import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSmartClassIds, getSurfacedClassIds } from "@/lib/collections";
import { getAssetStatus } from "@/lib/mux/client";

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
  instructorAvatarUrl: string | null;
  durationMinutes: number;
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  sourceMuxAssetId: string | null;
  /** True when this class is a trimmed clip whose Mux asset has finished encoding. */
  clipReady: boolean;
  publishedAt: string | null;
  surfaced: boolean;
  /** Admin display date as YYYY-MM-DD. */
  classDate: string | null;
}

/**
 * All classes (drafts included) for the admin list. `surfaced` is true when a
 * published collection (manual or smart) would show the class on the member side.
 */
export async function getAdminClasses(): Promise<AdminClassRow[]> {
  const supabase = createAdminClient();
  const [{ data: classes }, { data: instructors }, surfaced] = await Promise.all([
    supabase.from("classes").select("*").order("created_at", { ascending: false }),
    supabase.from("instructors").select("id,name,avatar_url"),
    getSurfacedClassIds(supabase),
  ]);

  const instructorById = new Map((instructors ?? []).map((i) => [i.id, i]));

  const rows: AdminClassRow[] = (classes ?? []).map((c) => {
    const inst = c.instructor_id ? instructorById.get(c.instructor_id) : null;
    return {
      id: c.id,
      title: c.title,
      instructorName: inst?.name ?? c.instructor_name ?? "",
      instructorAvatarUrl: inst?.avatar_url ?? null,
      durationMinutes: c.duration_minutes,
      muxPlaybackId: c.mux_playback_id,
      muxAssetId: c.mux_asset_id,
      sourceMuxAssetId: c.source_mux_asset_id ?? null,
      clipReady: false,
      publishedAt: c.published_at,
      surfaced: surfaced.has(c.id),
      classDate: c.class_date ?? null,
    };
  });

  // Only a trimmed clip still awaiting cleanup has a source recording. Resolve
  // its encode status (in parallel, just for that small subset) so the overview
  // can gate the "delete raw" action on the clip being ready.
  await Promise.all(
    rows.map(async (r) => {
      if (r.sourceMuxAssetId && r.muxAssetId) {
        r.clipReady = (await getAssetStatus(r.muxAssetId)) === "ready";
      }
    }),
  );

  return rows;
}

export interface AdminClassDetail {
  id: string;
  title: string;
  instructorId: string | null;
  description: string;
  durationMinutes: number;
  muxPlaybackId: string | null;
  muxAssetId: string | null;
  sourceMuxAssetId: string | null;
  publishedAt: string | null;
  /** Admin display date as YYYY-MM-DD. */
  classDate: string | null;
  tagIds: string[];
  /** Manual collections this class currently belongs to (for the form picker). */
  collectionIds: string[];
}

/** A single class with its tag ids + collection memberships, for the edit form. */
export async function getAdminClass(id: string): Promise<AdminClassDetail | null> {
  const supabase = createAdminClient();
  const { data: c } = await supabase.from("classes").select("*").eq("id", id).single();
  if (!c) return null;

  const [{ data: ct }, { data: cc }] = await Promise.all([
    supabase.from("class_tags").select("tag_id").eq("class_id", id),
    supabase.from("collection_classes").select("collection_id").eq("class_id", id),
  ]);

  return {
    id: c.id,
    title: c.title,
    instructorId: c.instructor_id ?? null,
    description: c.description ?? "",
    durationMinutes: c.duration_minutes,
    muxPlaybackId: c.mux_playback_id,
    muxAssetId: c.mux_asset_id,
    sourceMuxAssetId: c.source_mux_asset_id ?? null,
    publishedAt: c.published_at,
    classDate: c.class_date ?? null,
    tagIds: (ct ?? []).map((r) => r.tag_id),
    collectionIds: (cc ?? []).map((r) => r.collection_id),
  };
}

// ── Instructors admin ──────────────────────────────────

export interface AdminInstructor {
  id: string;
  name: string;
  avatarUrl: string | null;
  classCount: number;
}

/** All instructors with how many classes each is assigned to (for delete confirms). */
export async function getInstructors(): Promise<AdminInstructor[]> {
  const supabase = createAdminClient();
  const [{ data: instructors }, { data: classes }] = await Promise.all([
    supabase.from("instructors").select("*").order("name"),
    supabase.from("classes").select("instructor_id"),
  ]);

  const counts = new Map<string, number>();
  for (const c of classes ?? []) {
    if (c.instructor_id) counts.set(c.instructor_id, (counts.get(c.instructor_id) ?? 0) + 1);
  }

  return (instructors ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    avatarUrl: i.avatar_url,
    classCount: counts.get(i.id) ?? 0,
  }));
}

export interface InstructorOption {
  id: string;
  name: string;
}

/** Lightweight instructor list for the class form picker. */
export async function getInstructorOptions(): Promise<InstructorOption[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("instructors").select("id,name").order("name");
  return (data ?? []).map((i) => ({ id: i.id, name: i.name }));
}

// ── Taxonomy admin (with usage counts for the delete confirm) ──

export interface AdminTagUsage extends AdminTag {
  classCount: number;
  collectionCount: number;
}

export interface AdminTagGroupWithUsage {
  id: string;
  name: string;
  slug: string;
  position: number;
  tags: AdminTagUsage[];
}

export interface TagsAdminData {
  groups: AdminTagGroupWithUsage[];
  ungrouped: AdminTagUsage[];
}

export async function getTagsAdmin(): Promise<TagsAdminData> {
  const supabase = createAdminClient();
  const [{ data: groups }, { data: tags }, { data: classTags }, { data: ruleTags }] =
    await Promise.all([
      supabase.from("tag_groups").select("*").order("position"),
      supabase.from("tags").select("*").order("position"),
      supabase.from("class_tags").select("tag_id"),
      supabase.from("collection_rule_tags").select("tag_id"),
    ]);

  const classCounts = new Map<string, number>();
  for (const r of classTags ?? [])
    classCounts.set(r.tag_id, (classCounts.get(r.tag_id) ?? 0) + 1);
  const collectionCounts = new Map<string, number>();
  for (const r of ruleTags ?? [])
    collectionCounts.set(r.tag_id, (collectionCounts.get(r.tag_id) ?? 0) + 1);

  const toUsage = (t: { id: string; name: string; slug: string; group_id: string | null; position: number }): AdminTagUsage => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    groupId: t.group_id,
    position: t.position,
    classCount: classCounts.get(t.id) ?? 0,
    collectionCount: collectionCounts.get(t.id) ?? 0,
  });

  const allTags = (tags ?? []).map(toUsage);

  return {
    groups: (groups ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      position: g.position,
      tags: allTags.filter((t) => t.groupId === g.id),
    })),
    ungrouped: allTags.filter((t) => t.groupId === null),
  };
}

// ── Collections admin ──────────────────────────────────

export interface AdminCollectionRow {
  id: string;
  title: string;
  slug: string;
  kind: "manual" | "smart";
  matchMode: "any" | "all";
  position: number;
  publishedAt: string | null;
  itemCount: number;
}

export interface CollectionOption {
  id: string;
  title: string;
  /** New classes are auto-added to this collection — pre-checked in the class form. */
  autoAddNew: boolean;
  published: boolean;
}

/**
 * Manual collections for the class-form picker, ordered by browse position. Only
 * manual collections can have explicit members — smart collections are tag-rule
 * driven, so they're never selectable here.
 */
export async function getCollectionOptions(): Promise<CollectionOption[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("collections")
    .select("id,title,auto_add_new,published_at")
    .eq("kind", "manual")
    .order("position");
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    autoAddNew: !!c.auto_add_new,
    published: !!c.published_at,
  }));
}

export async function getAdminCollections(): Promise<AdminCollectionRow[]> {
  const supabase = createAdminClient();
  const [{ data: cols }, { data: members }, { data: rules }] = await Promise.all([
    supabase.from("collections").select("*").order("position"),
    supabase.from("collection_classes").select("collection_id"),
    supabase.from("collection_rule_tags").select("collection_id"),
  ]);

  const memberCounts = new Map<string, number>();
  for (const m of members ?? [])
    memberCounts.set(m.collection_id, (memberCounts.get(m.collection_id) ?? 0) + 1);
  const ruleCounts = new Map<string, number>();
  for (const r of rules ?? [])
    ruleCounts.set(r.collection_id, (ruleCounts.get(r.collection_id) ?? 0) + 1);

  return (cols ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    kind: c.kind,
    matchMode: c.match_mode,
    position: c.position,
    publishedAt: c.published_at,
    itemCount: c.kind === "smart" ? ruleCounts.get(c.id) ?? 0 : memberCounts.get(c.id) ?? 0,
  }));
}

export interface AdminCollectionDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  kind: "manual" | "smart";
  matchMode: "any" | "all";
  position: number;
  publishedAt: string | null;
  autoAddNew: boolean;
  displayLimit: number | null;
  memberClassIds: string[];
  ruleTagIds: string[];
}

export async function getAdminCollection(id: string): Promise<AdminCollectionDetail | null> {
  const supabase = createAdminClient();
  const { data: c } = await supabase.from("collections").select("*").eq("id", id).single();
  if (!c) return null;

  const [{ data: members }, { data: rules }] = await Promise.all([
    supabase
      .from("collection_classes")
      .select("class_id,position")
      .eq("collection_id", id)
      .order("position"),
    supabase.from("collection_rule_tags").select("tag_id").eq("collection_id", id),
  ]);

  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description ?? "",
    kind: c.kind,
    matchMode: c.match_mode,
    position: c.position,
    publishedAt: c.published_at,
    autoAddNew: !!c.auto_add_new,
    displayLimit: c.display_limit ?? null,
    memberClassIds: (members ?? []).map((m) => m.class_id),
    ruleTagIds: (rules ?? []).map((r) => r.tag_id),
  };
}

export interface SmartCollectionClass {
  id: string;
  title: string;
  muxPlaybackId: string | null;
  publishedAt: string | null;
  classDate: string | null;
}

/**
 * The classes a smart collection currently matches, in the order they'll appear:
 * any newly-matched class (no stored position yet) leads, newest published first,
 * followed by the admin-arranged ones in their saved overlay order. Membership is
 * always live from the tag rule — the stored positions are only an ordering hint.
 */
export async function getSmartCollectionClasses(
  collectionId: string,
  ruleTagIds: string[],
  matchMode: "any" | "all",
): Promise<SmartCollectionClass[]> {
  const supabase = createAdminClient();
  const matched = await resolveSmartClassIds(supabase, ruleTagIds, matchMode);
  if (matched.length === 0) return [];

  const [{ data: classes }, { data: posRows }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,title,mux_playback_id,published_at,class_date")
      .in("id", matched),
    supabase
      .from("collection_classes")
      .select("class_id,position")
      .eq("collection_id", collectionId),
  ]);

  const byId = new Map((classes ?? []).map((c) => [c.id, c]));
  const posById = new Map((posRows ?? []).map((r) => [r.class_id, r.position as number]));
  const present = matched.filter((id) => byId.has(id));

  const positioned = present
    .filter((id) => posById.has(id))
    .sort((a, b) => posById.get(a)! - posById.get(b)!);
  const fresh = present
    .filter((id) => !posById.has(id))
    .sort((a, b) =>
      (byId.get(b)?.published_at ?? "").localeCompare(byId.get(a)?.published_at ?? ""),
    );

  return [...fresh, ...positioned].map((id) => {
    const c = byId.get(id)!;
    return {
      id: c.id,
      title: c.title,
      muxPlaybackId: c.mux_playback_id,
      publishedAt: c.published_at,
      classDate: c.class_date ?? null,
    };
  });
}
