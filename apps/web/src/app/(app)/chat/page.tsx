import type { Viewport } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { noteChatSeen } from "@/lib/chat/dot-server";
import { chatName, COMMUNITY_CHANNEL, joinCommunityChat, streamServer, type ChatUser } from "@/lib/chat/server";
import { RoomHeader } from "@/components/chat/chat-headers";
import { ChatRoom } from "@/components/chat/chat-room";

/**
 * The group chat — one room for now, in the Ladder-style design (plan.md →
 * Group Chat). Admin-only until it opens to members, like Studio and Workouts.
 *
 * Before anything reaches the browser the server puts the viewer in the room
 * (their Stream user, name and photo from Clerk, trainer or not); the browser
 * then connects with a token from getChatToken().
 */
/**
 * The bar around an iPhone's notch in the chat's background from the first
 * paint, by the device's light or dark — the chat then holds it to the
 * appearance chosen on the site (chat-room.tsx).
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0C1014" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

export default async function ChatPage() {
  await requireSectionUnlocked();
  const { userId } = await auth();
  const server = streamServer();
  if (!userId || !server) {
    return <Notice>Chat isn&rsquo;t set up yet: the Stream keys are missing (see .env.example).</Notice>;
  }

  const clerkUser = await currentUser();
  const trainer = clerkUser?.publicMetadata.trainer === true;
  const user: ChatUser = {
    id: userId,
    name: clerkUser ? chatName(clerkUser, trainer) : "Member",
    // Clerk makes up a placeholder picture when there's no photo; Stream's initials look better.
    ...(clerkUser?.hasImage ? { image: clerkUser.imageUrl } : {}),
  };

  try {
    // Opening the chat sees what's there: the Chat tab's dot goes.
    await Promise.all([joinCommunityChat(server, user, trainer), noteChatSeen(userId)]);
  } catch (error) {
    console.error("[chat] joining the room:", error);
    return <Notice>Chat couldn&rsquo;t connect just now. Try again in a moment.</Notice>;
  }

  return (
    // The room fills the screen and scrolls inside itself. On a phone it
    // covers the whole screen — the site's header and tab bar step aside on
    // /chat for the chat's own header (PhoneHeader, TabBar) — and on desktop
    // the space beside the sidebar.
    <div className="fixed inset-0 z-30 bg-background md:static md:z-auto md:h-dvh">
      <ChatRoom apiKey={process.env.NEXT_PUBLIC_STREAM_API_KEY!} user={user} room={COMMUNITY_CHANNEL} trainer={trainer} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <RoomHeader />
      <p className="mx-auto max-w-6xl px-6 pt-4 text-zinc-500 sm:px-8 md:pt-10 dark:text-zinc-400">{children}</p>
    </div>
  );
}
