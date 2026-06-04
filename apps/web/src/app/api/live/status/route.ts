import { LIVE_PLAYBACK_ID } from "@/lib/live-stream-config";
import { mux } from "@/lib/mux/client";

export const dynamic = "force-dynamic";

const jsonHeaders = {
  "Cache-Control": "no-store",
};

export async function GET() {
  try {
    for await (const stream of mux.video.liveStreams.list({
      status: "active",
      limit: 100,
    })) {
      const hasPlaybackId = stream.playback_ids?.some(
        (playbackId) => playbackId.id === LIVE_PLAYBACK_ID,
      );

      if (hasPlaybackId) {
        return Response.json(
          {
            isLive: true,
            status: stream.status,
            checkedAt: new Date().toISOString(),
          },
          { headers: jsonHeaders },
        );
      }
    }

    return Response.json(
      {
        isLive: false,
        status: "idle",
        checkedAt: new Date().toISOString(),
      },
      { headers: jsonHeaders },
    );
  } catch (error) {
    console.error("[live/status] failed to check Mux live stream", error);
    return Response.json(
      {
        isLive: false,
        status: "unknown",
        checkedAt: new Date().toISOString(),
      },
      { headers: jsonHeaders },
    );
  }
}
