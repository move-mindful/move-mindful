import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth/admin";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { chatName, COMMUNITY_CHANNEL, joinCommunityChat, streamServer, type ChatUser } from "@/lib/chat/server";
import { ChatRoom } from "@/components/chat/chat-room";

/**
 * The group chat — one room for now, in Stream's own look while admins try it
 * out; the Ladder-style rows come next (plan.md → Group Chat). Admin-only
 * until it opens to members, like Studio and Workouts.
 *
 * Before anything reaches the browser the server puts the viewer in the room
 * (their Stream user, name and photo from Clerk); the browser then connects
 * with a token from getChatToken().
 */
export default async function ChatPage() {
  await requireSectionUnlocked();
  const { userId } = await auth();
  const server = streamServer();
  if (!userId || !server) {
    return <Notice>Chat isn&rsquo;t set up yet: the Stream keys are missing (see .env.example).</Notice>;
  }

  const clerkUser = await currentUser();
  const user: ChatUser = {
    id: userId,
    name: clerkUser ? chatName(clerkUser) : "Member",
    // Clerk makes up a placeholder picture when there's no photo; Stream's initials look better.
    ...(clerkUser?.hasImage ? { image: clerkUser.imageUrl } : {}),
  };

  try {
    await joinCommunityChat(server, user, await isAdmin());
  } catch (error) {
    console.error("[chat] joining the room:", error);
    return <Notice>Chat couldn&rsquo;t connect just now. Try again in a moment.</Notice>;
  }

  return (
    // The room fills the screen and scrolls inside itself: on a phone, the
    // space between the header (h-16) and the tab bar (the shell's pb-24).
    <div className="h-[calc(100dvh-10rem)] md:h-dvh">
      <ChatRoom apiKey={process.env.NEXT_PUBLIC_STREAM_API_KEY!} user={user} room={COMMUNITY_CHANNEL} />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto max-w-6xl px-6 pt-10 text-zinc-500 sm:px-8 dark:text-zinc-400">{children}</p>;
}
