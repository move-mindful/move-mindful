"use server";

import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth/admin";
import { chatToken, streamServer } from "@/lib/chat/server";

/**
 * The token the chat connects to Stream with — asked for when the page opens
 * and again each time the last one runs out. The member comes from the Clerk
 * session, never the request. Admin-only for now, like the /chat page; when
 * chat opens to members this becomes the membership check.
 */
export async function getChatToken(): Promise<string> {
  const { userId } = await auth();
  if (!userId || !(await isAdmin())) throw new Error("Chat isn't open to this account.");
  const server = streamServer();
  if (!server) throw new Error("Chat isn't set up.");
  return chatToken(server, userId);
}
