import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { cleanPlayerPreferences, type PlayerPreferences } from "@/lib/member/preferences";

/**
 * A member's saved workout player settings — only the ones they've set; the
 * player fills in the rest. `userId` must come from the Clerk session.
 */
export async function getPlayerPreferences(userId: string): Promise<Partial<PlayerPreferences>> {
  const { data } = await createAdminClient()
    .from("member_preferences")
    .select("preferences")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  const prefs = data?.preferences as Record<string, unknown> | undefined;
  return cleanPlayerPreferences(prefs?.workoutPlayer);
}
