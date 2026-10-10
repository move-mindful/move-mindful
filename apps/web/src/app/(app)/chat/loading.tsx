import { ChatSkeleton } from "@/components/chat/chat-skeleton";

/**
 * /chat while it loads: the chat's own placeholder in place of the generic
 * one in (app)/loading.tsx, in the page's own frame (page.tsx), so the same
 * skeleton carries on while the chat connects.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-30 bg-background md:static md:z-auto md:h-dvh">
      <ChatSkeleton />
    </div>
  );
}
