import { DOT_AFTER_MAX, getDotAfter } from "@/lib/chat/dot-server";
import { ChatDotSetting } from "@/components/admin/chat-dot-setting";

export const dynamic = "force-dynamic";

/** Admin → Chat: settings for the group chat. For now, when the Chat tab's dot shows. */
export default async function AdminChatPage() {
  const dotAfter = await getDotAfter();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Chat</h1>
      <p className="mt-1 text-zinc-500">Settings for the group chat, for everyone.</p>
      <div className="mt-8">
        <ChatDotSetting initial={dotAfter} max={DOT_AFTER_MAX} />
      </div>
    </div>
  );
}
