import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The violet dot on the Chat tab: shown when a trainer has posted in the room
 * since the member last had the chat open, and never for members' messages
 * (plan.md → Group Chat). Two timestamps, compared when a page asks:
 *
 * - when a trainer last posted, from Stream's message.new webhook
 *   (app/api/webhooks/stream), kept as one app_settings row;
 * - when this member last looked, `member_preferences.chat_seen_at`
 *   (025_chat_seen.sql), noted as they open and leave /chat.
 *
 * Until the migration has run there's no dot, rather than an error.
 */

const LAST_TRAINER_POST = "chat_last_trainer_post_at";

/** The column isn't there yet (025_chat_seen.sql not run): PostgREST's and Postgres's codes for it. */
const NOT_MIGRATED = new Set(["PGRST204", "42703"]);

/** Note a trainer's post. Only ever moves forward, should events arrive out of order. */
export async function recordTrainerPost(at: string): Promise<boolean> {
  if (Number.isNaN(Date.parse(at))) return true;
  const supabase = createAdminClient();
  const { data, error: readError } = await supabase.from("app_settings").select("value").eq("key", LAST_TRAINER_POST).maybeSingle();
  if (readError) {
    console.error("[chat-dot] reading the last trainer post:", readError);
    return false;
  }
  if (data && Date.parse(data.value) >= Date.parse(at)) return true;
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: LAST_TRAINER_POST, value: at, updated_at: new Date().toISOString() });
  if (error) console.error("[chat-dot] saving the last trainer post:", error);
  return !error;
}

/**
 * TEMPORARY, while the webhooks are being proved: the last thing that went
 * wrong with a call from Stream (a rejected signature, a skipped message),
 * kept in app_settings under `chat_webhook_trouble` so it can be read back
 * without Vercel's logs. Remove once the dot is seen working.
 */
export async function noteWebhookTrouble(what: string): Promise<void> {
  await createAdminClient()
    .from("app_settings")
    .upsert({ key: "chat_webhook_trouble", value: `${new Date().toISOString()} ${what}`, updated_at: new Date().toISOString() });
}

/** The member has the chat in front of them: whatever's there now counts as seen. */
export async function noteChatSeen(userId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("member_preferences")
    .upsert({ clerk_user_id: userId, chat_seen_at: new Date().toISOString() }, { onConflict: "clerk_user_id" });
  if (error && !NOT_MIGRATED.has(error.code)) console.error(`[chat-dot] ${userId}:`, error);
}

/** Has a trainer posted since this member last looked? Never opened the chat counts as not yet seen. */
export async function hasUnseenTrainerPost(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const [post, seen] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", LAST_TRAINER_POST).maybeSingle(),
    supabase.from("member_preferences").select("chat_seen_at").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  if (post.error || seen.error || !post.data) return false;
  const seenAt: string | null | undefined = seen.data?.chat_seen_at;
  return !seenAt || Date.parse(post.data.value) > Date.parse(seenAt);
}
