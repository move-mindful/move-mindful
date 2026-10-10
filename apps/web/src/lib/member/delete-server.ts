import "server-only";

import { deleteChatUser } from "@/lib/chat/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Remove everything the database keeps about a member, keyed by their Clerk
 * id — for when their account is deleted (the Clerk webhook's user.deleted).
 * Their settings, workout sessions, workout ratings and profile row, plus
 * their chat user and messages on Stream. Safe to run twice. Returns false if
 * anything failed, so the webhook asks Clerk to retry.
 */
export async function deleteMemberData(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const [chatDeleted, ...results] = await Promise.all([
    deleteChatUser(userId),
    supabase.from("workout_sessions").delete().eq("clerk_user_id", userId),
    supabase.from("member_preferences").delete().eq("clerk_user_id", userId),
    supabase.from("workout_ratings").delete().eq("clerk_user_id", userId),
    supabase.from("user_profiles").delete().eq("clerk_id", userId),
  ]);
  // A table that isn't there yet (a migration not run, PGRST205) has nothing to delete.
  const failed = results.filter((r) => r.error && r.error.code !== "PGRST205");
  failed.forEach((r) => console.error(`[member-delete] ${userId}:`, r.error));
  return chatDeleted && failed.length === 0;
}
