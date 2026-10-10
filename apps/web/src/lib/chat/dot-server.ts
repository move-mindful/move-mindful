import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { COMMUNITY_CHANNEL, streamServer } from "@/lib/chat/server";

/**
 * The violet dot on the Chat tab (plan.md → Group Chat). It shows when, since
 * the member last had the chat open:
 *
 * - a trainer posted in the room — straight away, whatever else; or
 * - other people posted at least the admin's number of messages in the room
 *   (Admin → Chat; 1 to start, so any new message).
 *
 * What it compares, when a page asks:
 *
 * - when a trainer last posted, and when anyone last posted, from Stream's
 *   message.new webhook (app/api/webhooks/stream), one app_settings row each;
 * - when this member last looked, `member_preferences.chat_seen_at`
 *   (025_chat_seen.sql), noted as they open and leave /chat;
 * - past 1, the messages themselves, counted from Stream — only asked for when
 *   the room has moved on since the member last looked.
 *
 * Until the migration has run there's no dot, rather than an error.
 */

const LAST_TRAINER_POST = "chat_last_trainer_post_at";
const LAST_MESSAGE = "chat_last_message_at";
const DOT_AFTER = "chat_dot_after";

/** How many new messages the dot waits for, before the admin picks: any one. */
export const DOT_AFTER_DEFAULT = 1;
/** The most the admin can set; the count from Stream reads past it. */
export const DOT_AFTER_MAX = 100;

/** The column isn't there yet (025_chat_seen.sql not run): PostgREST's and Postgres's codes for it. */
const NOT_MIGRATED = new Set(["PGRST204", "42703"]);

/**
 * Note a post in the room: when the room last moved, and when a trainer last
 * posted if it's theirs. Each only ever moves forward, should events arrive
 * out of order.
 */
export async function recordRoomMessage(at: string, trainer: boolean): Promise<boolean> {
  if (Number.isNaN(Date.parse(at))) return true;
  const saved = await Promise.all([moveForward(LAST_MESSAGE, at), trainer ? moveForward(LAST_TRAINER_POST, at) : true]);
  return saved.every(Boolean);
}

async function moveForward(key: string, at: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error: readError } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  if (readError) {
    console.error(`[chat-dot] reading ${key}:`, readError);
    return false;
  }
  if (data && Date.parse(data.value) >= Date.parse(at)) return true;
  const { error } = await supabase.from("app_settings").upsert({ key, value: at, updated_at: new Date().toISOString() });
  if (error) console.error(`[chat-dot] saving ${key}:`, error);
  return !error;
}

/** The member has the chat in front of them: whatever's there now counts as seen. */
export async function noteChatSeen(userId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("member_preferences")
    .upsert({ clerk_user_id: userId, chat_seen_at: new Date().toISOString() }, { onConflict: "clerk_user_id" });
  if (error && !NOT_MIGRATED.has(error.code)) console.error(`[chat-dot] ${userId}:`, error);
}

/** The admin's number: how many new messages before the dot shows. */
export async function getDotAfter(): Promise<number> {
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", DOT_AFTER).maybeSingle();
  return cleanDotAfter(data?.value) ?? DOT_AFTER_DEFAULT;
}

/** Save the admin's number; null if it isn't a whole number from 1 to DOT_AFTER_MAX. */
export async function setDotAfter(value: unknown): Promise<number | null> {
  const n = cleanDotAfter(value);
  if (n === null) return null;
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: DOT_AFTER, value: String(n), updated_at: new Date().toISOString() });
  if (error) {
    console.error("[chat-dot] saving the number:", error);
    return null;
  }
  return n;
}

function cleanDotAfter(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n >= 1 && n <= DOT_AFTER_MAX ? n : null;
}

/** Whether this member's Chat tab shows its dot. Never opened the chat counts as never seen. */
export async function hasChatDot(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const [settings, seen] = await Promise.all([
    supabase.from("app_settings").select("key, value").in("key", [LAST_TRAINER_POST, LAST_MESSAGE, DOT_AFTER]),
    supabase.from("member_preferences").select("chat_seen_at").eq("clerk_user_id", userId).maybeSingle(),
  ]);
  if (settings.error || seen.error) return false;
  const value = (key: string) => settings.data.find((row) => row.key === key)?.value as string | undefined;
  const seenAt: string | null = seen.data?.chat_seen_at ?? null;
  const since = (at: string | undefined) => !!at && (!seenAt || Date.parse(at) > Date.parse(seenAt));

  if (since(value(LAST_TRAINER_POST))) return true;
  if (!since(value(LAST_MESSAGE))) return false;
  const dotAfter = cleanDotAfter(value(DOT_AFTER)) ?? DOT_AFTER_DEFAULT;
  // The room's moved on: at 1 that's enough. (Your own posts come while you're
  // in the chat, and leaving it notes it seen.)
  if (dotAfter <= 1) return true;
  return (await countNewMessages(userId, seenAt, dotAfter)) >= dotAfter;
}

/**
 * Other people's messages in the room since `seenAt` (all of them, if never
 * seen), counted up to a little past `enough` — no need to know beyond it.
 * Thread replies don't count unless they were also sent to the room, as
 * Stream lists the room. Zero if Stream can't be asked.
 */
async function countNewMessages(userId: string, seenAt: string | null, enough: number): Promise<number> {
  const server = streamServer();
  if (!server) return 0;
  try {
    const { messages } = await server.channel(COMMUNITY_CHANNEL.type, COMMUNITY_CHANNEL.id).query({
      state: true,
      watch: false,
      presence: false,
      // Your own count toward the limit too, so ask for some room beyond it.
      messages: { limit: Math.min(300, enough * 2 + 20), ...(seenAt ? { created_at_after: seenAt } : {}) },
    });
    return messages.filter((m) => m.type === "regular" && m.user?.id !== userId).length;
  } catch (error) {
    console.error("[chat-dot] counting new messages:", error);
    return 0;
  }
}
