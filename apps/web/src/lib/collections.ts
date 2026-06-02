import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolve which class ids match a smart collection's tag rule.
 * - "any": the class has at least one of the rule tags
 * - "all": the class has every rule tag
 *
 * Operates over all classes; callers filter by published status as needed.
 */
export async function resolveSmartClassIds(
  supabase: AdminClient,
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
