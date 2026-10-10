"use server";

import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth/admin";
import { hasUnseenTrainerPost, noteChatSeen } from "@/lib/chat/dot-server";
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

/** Whether the Chat tab shows its dot: a trainer has posted since this member last looked. */
export async function getChatDot(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) return false;
  return hasUnseenTrainerPost(userId);
}

/** The member is leaving the chat (or putting it away): what they've seen clears the dot. */
export async function markChatSeen(): Promise<void> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) return;
  await noteChatSeen(userId);
}
