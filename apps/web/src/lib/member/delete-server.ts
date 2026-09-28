import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Remove everything the database keeps about a member, keyed by their Clerk
 * id — for when their account is deleted (the Clerk webhook's user.deleted).
 * Their settings, workout sessions and profile row. Safe to run twice.
 * Returns false if anything failed, so the webhook asks Clerk to retry.
 */
export async function deleteMemberData(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const results = await Promise.all([
    supabase.from("workout_sessions").delete().eq("clerk_user_id", userId),
    supabase.from("member_preferences").delete().eq("clerk_user_id", userId),
    supabase.from("user_profiles").delete().eq("clerk_id", userId),
  ]);
  const failed = results.filter((r) => r.error);
  failed.forEach((r) => console.error(`[member-delete] ${userId}:`, r.error));
  return failed.length === 0;
}
