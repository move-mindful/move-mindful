import { streamServer } from "@/lib/chat/server";

/**
 * Stream's before-message-send hook (scripts/stream-hooks.mjs points it here):
 * Stream asks before saving each message. Members post photos; only trainers
 * (Stream's admin role, which nobody can give themselves) post videos. The
 * chat's photo button already offers members images only — this turns away a
 * video sent any other way, before anyone sees it.
 *
 * To turn a message away, answer 200 with an `error` message whose text the
 * sender sees; anything else lets it through. Stream lets messages through
 * too if this is down or slow (over 1.5 s by default), so it backs up the
 * picker rather than replacing it.
 *
 * Public by necessity — the caller is Stream — so the signature, an HMAC of
 * the body made with our API secret, is checked first.
 */

interface BeforeSend {
  message?: { attachments?: Array<{ type?: string; mime_type?: string }> };
  user?: { role?: string };
}

export async function POST(request: Request) {
  const server = streamServer();
  if (!server) return new Response("Not configured", { status: 500 });

  const body = await request.text();
  const signature = request.headers.get("x-signature");
  let valid = false;
  try {
    valid = !!signature && server.verifyWebhook(body, signature);
  } catch {
    valid = false;
  }
  if (!valid) return new Response("Invalid signature", { status: 401 });

  const { message, user } = JSON.parse(body) as BeforeSend;
  const hasVideo = (message?.attachments ?? []).some(
    (a) => a.type === "video" || (a.mime_type ?? "").startsWith("video/"),
  );
  if (hasVideo && user?.role !== "admin") {
    return Response.json({ message: { type: "error", text: "Only trainers can post videos. Photos are welcome!" } });
  }
  return Response.json({ message });
}
