import "server-only";

import { StreamChat } from "stream-chat";

/**
 * Group chat, on Stream (plan.md → Group Chat). Our server is the only thing
 * that can let anyone in: it holds the secret, creates each person's Stream
 * user and channel membership, and signs the tokens the browser connects
 * with. Messages then go from the browser straight to Stream.
 *
 * Admin-only for now — the /chat page and getChatToken() both check — with a
 * single room everyone joins.
 */

/** The one room, for now. Its name shows in the chat's header. */
export const COMMUNITY_CHANNEL = { type: "messaging", id: "community", name: "Move Mindful" } as const;

/** Null until the Stream keys are set (see .env.example), so callers can say so rather than crash. */
export function streamServer(): StreamChat | null {
  const key = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (!key || !secret) return null;
  return StreamChat.getInstance(key, secret);
}

export interface ChatUser {
  id: string;
  name: string;
  image?: string;
}

/** How the chat names everyone: first name and last initial, no full stop ("Jess M"), never a full surname. */
export function chatName(user: { firstName: string | null; lastName: string | null; username: string | null }): string {
  const first = user.firstName?.trim();
  const initial = user.lastName?.trim().charAt(0).toUpperCase();
  if (first) return initial ? `${first} ${initial}` : first;
  return user.username || "Member";
}

/**
 * Create or refresh the viewer's Stream user (name and photo from Clerk) and
 * make sure they're in the room, creating it the first time. Run each time
 * the page loads, so a changed name or photo carries over.
 *
 * Trainers (`trainer: true` in their Clerk public metadata — Ayla) get
 * Stream's admin role and everyone else, admins of the site included, the
 * plain user role. The role is how the chat tells a trainer's posts apart
 * (the badge, the gradient box) because nobody can change their own role on
 * Stream, whereas a custom field on the user they could.
 */
export async function joinCommunityChat(server: StreamChat, user: ChatUser, trainer: boolean): Promise<void> {
  await server.upsertUser({ ...user, role: trainer ? "admin" : "user" });

  const channel = server.channel(COMMUNITY_CHANNEL.type, COMMUNITY_CHANNEL.id, {
    name: COMMUNITY_CHANNEL.name,
    created_by_id: user.id,
  });
  // Creates the room the first time; after that it just loads it.
  await channel.create();
  const { members } = await channel.queryMembers({ user_id: user.id });
  if (members.length === 0) await channel.addMembers([user.id]);
}

/** A token for the browser to connect with, good for an hour; the chat asks for a new one as it runs out. */
export function chatToken(server: StreamChat, userId: string): string {
  return server.createToken(userId, Math.floor(Date.now() / 1000) + 60 * 60);
}

/**
 * Remove the member from Stream when their account is deleted — the user and
 * their messages. True when there's nothing left there (no keys set, or they
 * never chatted), false on a failure so the webhook asks Clerk to retry.
 */
export async function deleteChatUser(userId: string): Promise<boolean> {
  const server = streamServer();
  if (!server) return true;
  try {
    // Most members never open the chat, so look first rather than read
    // "nothing to delete" out of an error.
    const { users } = await server.queryUsers({ id: userId });
    if (users.length > 0) await server.deleteUser(userId, { hard_delete: true, mark_messages_deleted: true });
    return true;
  } catch (error) {
    console.error(`[chat-delete] ${userId}:`, error);
    return false;
  }
}
