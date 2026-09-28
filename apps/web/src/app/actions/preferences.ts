"use server";

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanPlayerPreferences, type PlayerPreferences } from "@/lib/member/preferences";

/**
 * Save the signed-in member's workout player settings to their account,
 * merged over what's there. The member comes from the Clerk session, never
 * from the request; signed out, it does nothing (the player keeps settings on
 * the device instead).
 */
export async function savePlayerPreferences(input: Partial<PlayerPreferences>): Promise<{ saved: boolean }> {
  const { userId } = await auth();
  if (!userId) return { saved: false };
  const changes = cleanPlayerPreferences(input);
  if (!Object.keys(changes).length) return { saved: false };

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("member_preferences")
    .select("preferences")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  const all = (data?.preferences ?? {}) as Record<string, unknown>;
  const preferences = {
    ...all,
    workoutPlayer: { ...cleanPlayerPreferences(all.workoutPlayer), ...changes },
  };
  const { error } = await supabase
    .from("member_preferences")
    .upsert({ clerk_user_id: userId, preferences, updated_at: new Date().toISOString() });
  return { saved: !error };
}
