"use server";

import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth/admin";
import { DOT_AFTER_MAX, hasChatDot, noteChatSeen, setDotAfter } from "@/lib/chat/dot-server";
import { chatToken, streamServer } from "@/lib/chat/server";

/*
 * The member comes from the Clerk session, never the request. Admin-only for
 * now, like the /chat page; when chat opens to members, each of these swaps
 * the admin check for the membership one.
 */

/**
 * The token the chat connects to Stream with — asked for when the page opens
 * and again each time the last one runs out.
 */
export async function getChatToken(): Promise<string> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) throw new Error("Chat isn't open to this account.");
  const server = streamServer();
  if (!server) throw new Error("Chat isn't set up.");
  return chatToken(server, userId);
}

/**
 * Whether the Chat tab shows its dot: since this member last looked, a
 * trainer has posted, or the room has the admin's number of new messages.
 */
export async function getChatDot(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) return false;
  return hasChatDot(userId);
}

/** Admin → Chat: how many new messages before the dot shows, for everyone. */
export async function saveChatDotAfter(value: number): Promise<{ value?: number; error?: string }> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) return { error: "Only admins can change this." };
  const saved = await setDotAfter(value);
  return saved === null ? { error: `Couldn’t save that. Pick a whole number from 1 to ${DOT_AFTER_MAX}.` } : { value: saved };
}

/** The member is leaving the chat (or putting it away): what they've seen clears the dot. */
export async function markChatSeen(): Promise<void> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) return;
  await noteChatSeen(userId);
}
