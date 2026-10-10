import { recordTrainerPost } from "@/lib/chat/dot-server";
import { COMMUNITY_CHANNEL, streamServer } from "@/lib/chat/server";

/**
 * Stream's event webhook, subscribed to message.new only (scripts/stream-hooks.mjs
 * points it here). A trainer's post in the room notes the time, which lights
 * the violet dot on everyone's Chat tab until they next look (lib/chat/dot-server.ts).
 *
 * Public by necessity — the caller is Stream — so the signature, an HMAC of
 * the body made with our API secret, is checked before anything is trusted.
 */

interface StreamMessageEvent {
  type?: string;
  channel_id?: string;
  user?: { role?: string };
  message?: {
    created_at?: string;
    parent_id?: string;
    show_in_channel?: boolean;
    user?: { role?: string };
  };
}

export async function POST(request: Request) {
  const server = streamServer();
  if (!server) {
    console.error("[stream-webhook] the Stream keys are not set");
    return new Response("Not configured", { status: 500 });
  }

  // The raw body is what was signed, so read text and verify before parsing.
  const body = await request.text();
  if (!verified(server, body, request.headers.get("x-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(body) as StreamMessageEvent;
  const message = event.message;
  const trainer = (message?.user?.role ?? event.user?.role) === "admin";
  // A trainer's post in the room itself: not a reply inside a thread, unless
  // they also sent it to the room.
  const inRoom = !message?.parent_id || message.show_in_channel === true;
  if (event.type !== "message.new" || event.channel_id !== COMMUNITY_CHANNEL.id || !trainer || !inRoom || !message?.created_at) {
    return new Response("Ignored", { status: 200 });
  }

  // A failure answers 500 so Stream retries; noting the same post twice is harmless.
  return (await recordTrainerPost(message.created_at))
    ? new Response("OK", { status: 200 })
    : new Response("Save failed", { status: 500 });
}

function verified(server: NonNullable<ReturnType<typeof streamServer>>, body: string, signature: string | null): boolean {
  if (!signature) return false;
  try {
    return server.verifyWebhook(body, signature);
  } catch {
    return false;
  }
}
