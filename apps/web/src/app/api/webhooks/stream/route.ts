import { recordTrainerPost } from "@/lib/chat/dot-server";
import { COMMUNITY_CHANNEL, readStreamWebhook } from "@/lib/chat/server";

/**
 * Stream's event webhook, subscribed to message.new only (scripts/stream-hooks.mjs
 * points it here). A trainer's post in the room notes the time, which lights
 * the violet dot on everyone's Chat tab until they next look (lib/chat/dot-server.ts).
 *
 * Public by necessity — the caller is Stream — so nothing is trusted until
 * readStreamWebhook() has checked the signature.
 */

interface StreamMessageEvent {
  type?: string;
  cid?: string;
  channel_id?: string;
  user?: { role?: string };
  message?: {
    cid?: string;
    created_at?: string;
    parent_id?: string;
    show_in_channel?: boolean;
    user?: { role?: string };
  };
}

export async function POST(request: Request) {
  const read = await readStreamWebhook(request);
  if (!read.ok) {
    console.error("[stream-webhook]", read.reason);
    return new Response(read.status === 500 ? "Not configured" : "Invalid signature", { status: read.status });
  }

  const event = read.body as StreamMessageEvent;
  if (event.type !== "message.new") return new Response("Ignored", { status: 200 });

  const message = event.message;
  // The room: Stream names it in a couple of places, depending on the payload.
  const channelId = event.channel_id ?? event.cid?.split(":")[1] ?? message?.cid?.split(":")[1];
  const role = message?.user?.role ?? event.user?.role;
  // A trainer's post in the room itself: not a reply inside a thread, unless
  // they also sent it to the room.
  const inRoom = !message?.parent_id || message.show_in_channel === true;
  if (channelId !== COMMUNITY_CHANNEL.id || role !== "admin" || !inRoom || !message?.created_at) {
    return new Response("Ignored", { status: 200 });
  }

  // A failure answers 500 so Stream retries; noting the same post twice is harmless.
  return (await recordTrainerPost(message.created_at))
    ? new Response("OK", { status: 200 })
    : new Response("Save failed", { status: 500 });
}
