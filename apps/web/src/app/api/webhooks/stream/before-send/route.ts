import { noteWebhookTrouble } from "@/lib/chat/dot-server";
import { readStreamWebhook } from "@/lib/chat/server";

/**
 * Stream's before-message-send hook (scripts/stream-hooks.mjs points it here):
 * Stream asks before saving each message. Members post photos; only trainers
 * (Stream's admin role, which nobody can give themselves) post videos. The
 * chat's photo button already offers members images only — this turns away a
 * video sent any other way, before anyone sees it.
 *
 * To turn a message away, answer 200 with an `error` message whose text the
 * sender sees; anything else lets it through. Stream lets messages through
 * too if this is down or slow, so it backs up the picker rather than
 * replacing it.
 *
 * Public by necessity — the caller is Stream — so nothing is trusted until
 * readStreamWebhook() has checked the signature.
 */

interface BeforeSend {
  message?: { attachments?: Array<{ type?: string; mime_type?: string }> };
  user?: { role?: string };
}

export async function POST(request: Request) {
  const read = await readStreamWebhook(request);
  if (!read.ok) {
    console.error("[stream-before-send]", read.reason);
    // Only for calls that look like Stream's, so stray traffic leaves no trace.
    if (request.headers.has("x-signature")) await noteWebhookTrouble(`before-send: ${read.reason}`);
    return new Response(read.status === 500 ? "Not configured" : "Invalid signature", { status: read.status });
  }

  const { message, user } = read.body as BeforeSend;
  const hasVideo = (message?.attachments ?? []).some(
    (a) => a.type === "video" || (a.mime_type ?? "").startsWith("video/"),
  );
  if (hasVideo && user?.role !== "admin") {
    return Response.json({ message: { type: "error", text: "Only trainers can post videos. Photos are welcome!" } });
  }
  return Response.json({ message });
}
