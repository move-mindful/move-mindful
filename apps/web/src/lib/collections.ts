import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolve which class ids match a smart collection's tag rule.
 * - "any": the class has at least one of the rule tags
 * - "all": the class has every rule tag
 *
 * Operates over whatever rows the client can see (RLS scopes the member client
 * to published classes; the admin client sees everything).
 */
export async function resolveSmartClassIds(
  supabase: SupabaseClient,
  tagIds: string[],
  matchMode: "any" | "all",
): Promise<string[]> {
  if (tagIds.length === 0) return [];

  const { data } = await supabase
    .from("class_tags")
    .select("class_id,tag_id")
    .in("tag_id", tagIds);

  const byClass = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    let set = byClass.get(r.class_id);
    if (!set) {
      set = new Set<string>();
      byClass.set(r.class_id, set);
    }
    set.add(r.tag_id);
  }

  const out: string[] = [];
  for (const [classId, tags] of byClass) {
    const matches =
      matchMode === "all" ? tagIds.every((t) => tags.has(t)) : tags.size > 0;
    if (matches) out.push(classId);
  }
  return out;
}

/**
 * Class ids surfaced by ANY published collection — manual members plus smart-rule
 * matches. Used for the admin "Unlisted" flag (a published class not in this set
 * won't appear anywhere on the member browse page).
 */
export async function getSurfacedClassIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data: cols } = await supabase
    .from("collections")
    .select("id,kind,match_mode,published_at");
  const published = (cols ?? []).filter((c) => c.published_at);
  const publishedIds = new Set(published.map((c) => c.id));

  const surfaced = new Set<string>();

  const { data: members } = await supabase
    .from("collection_classes")
    .select("collection_id,class_id");
  for (const m of members ?? []) {
    if (publishedIds.has(m.collection_id)) surfaced.add(m.class_id);
  }

  const smart = published.filter((c) => c.kind === "smart");
  if (smart.length > 0) {
    const { data: ruleRows } = await supabase
      .from("collection_rule_tags")
      .select("collection_id,tag_id");
    const rulesByCol = new Map<string, string[]>();
    for (const r of ruleRows ?? []) {
      const arr = rulesByCol.get(r.collection_id) ?? [];
      arr.push(r.tag_id);
      rulesByCol.set(r.collection_id, arr);
    }
    for (const col of smart) {
      const ids = await resolveSmartClassIds(
        supabase,
        rulesByCol.get(col.id) ?? [],
        col.match_mode,
      );
      ids.forEach((id) => surfaced.add(id));
    }
  }

  return surfaced;
}

// ── Member browse ──────────────────────────────────────

export interface BrowseCard {
  id: string;
  title: string;
  instructorName: string;
  instructorAvatarUrl: string | null;
  durationMinutes: number;
  muxPlaybackId: string | null;
  disciplineLabel: string | null;
  intensitySlug: string | null;
  intensityLabel: string | null;
}

export interface BrowseRow {
  id: string;
  title: string;
  classes: BrowseCard[];
}

/**
 * Build the member browse rows: every published collection (in order) resolved to
 * its published classes. Uses the anon/RLS client so only published content is
 * ever returned. Empty rows are dropped.
 */
export async function getBrowseRows(): Promise<BrowseRow[]> {
  const supabase = await createClient();

  const { data: collections } = await supabase
    .from("collections")
    .select("*")
    .order("position");
  if (!collections || collections.length === 0) return [];

  const [
    { data: classes },
    { data: classTags },
    { data: tags },
    { data: groups },
    { data: members },
    { data: ruleTags },
    { data: instructors },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id,title,instructor_name,instructor_id,duration_minutes,mux_playback_id,published_at",
      ),
    supabase.from("class_tags").select("class_id,tag_id"),
    supabase.from("tags").select("id,name,slug,group_id"),
    supabase.from("tag_groups").select("id,slug"),
    supabase.from("collection_classes").select("collection_id,class_id,position").order("position"),
    supabase.from("collection_rule_tags").select("collection_id,tag_id"),
    supabase.from("instructors").select("id,name,avatar_url"),
  ]);

  const disciplineGroupId = (groups ?? []).find((g) => g.slug === "discipline")?.id ?? null;
  const intensityGroupId = (groups ?? []).find((g) => g.slug === "intensity")?.id ?? null;
  const tagById = new Map((tags ?? []).map((t) => [t.id, t]));
  const classById = new Map((classes ?? []).map((c) => [c.id, c]));
  const instructorById = new Map((instructors ?? []).map((i) => [i.id, i]));

  const tagsByClass = new Map<string, string[]>();
  for (const ct of classTags ?? []) {
    const arr = tagsByClass.get(ct.class_id) ?? [];
    arr.push(ct.tag_id);
    tagsByClass.set(ct.class_id, arr);
  }

  const toCard = (classId: string): BrowseCard | null => {
    const c = classById.get(classId);
    if (!c) return null;
    let disciplineLabel: string | null = null;
    let intensitySlug: string | null = null;
    let intensityLabel: string | null = null;
    for (const tid of tagsByClass.get(classId) ?? []) {
      const t = tagById.get(tid);
      if (!t) continue;
      if (t.group_id === disciplineGroupId && !disciplineLabel) disciplineLabel = t.name;
      if (t.group_id === intensityGroupId && !intensitySlug) {
        intensitySlug = t.slug;
        intensityLabel = t.name;
      }
    }
    const inst = c.instructor_id ? instructorById.get(c.instructor_id) : null;
    return {
      id: c.id,
      title: c.title,
      instructorName: inst?.name ?? c.instructor_name ?? "",
      instructorAvatarUrl: inst?.avatar_url ?? null,
      durationMinutes: c.duration_minutes,
      muxPlaybackId: c.mux_playback_id,
      disciplineLabel,
      intensitySlug,
      intensityLabel,
    };
  };

  const manualByCol = new Map<string, string[]>();
  for (const m of members ?? []) {
    const arr = manualByCol.get(m.collection_id) ?? [];
    arr.push(m.class_id);
    manualByCol.set(m.collection_id, arr);
  }

  const rulesByCol = new Map<string, string[]>();
  for (const r of ruleTags ?? []) {
    const arr = rulesByCol.get(r.collection_id) ?? [];
    arr.push(r.tag_id);
    rulesByCol.set(r.collection_id, arr);
  }

  const resolveSmart = (ruleTagIds: string[], matchMode: "any" | "all"): string[] => {
    if (ruleTagIds.length === 0) return [];
    const out: string[] = [];
    for (const [classId, tIds] of tagsByClass) {
      const matches =
        matchMode === "all"
          ? ruleTagIds.every((rt) => tIds.includes(rt))
          : ruleTagIds.some((rt) => tIds.includes(rt));
      if (matches) out.push(classId);
    }
    return out;
  };

  const rows: BrowseRow[] = [];
  for (const col of collections) {
    let classIds: string[];
    if (col.kind === "smart") {
      classIds = resolveSmart(rulesByCol.get(col.id) ?? [], col.match_mode);
      classIds.sort((a, b) =>
        (classById.get(b)?.published_at ?? "").localeCompare(
          classById.get(a)?.published_at ?? "",
        ),
      );
    } else {
      classIds = manualByCol.get(col.id) ?? [];
    }
    const cards = classIds.map(toCard).filter((c): c is BrowseCard => !!c);
    const limit = (col.display_limit as number | null) ?? null;
    const limited = limit && limit > 0 ? cards.slice(0, limit) : cards;
    if (limited.length > 0) rows.push({ id: col.id, title: col.title, classes: limited });
  }
  return rows;
}
