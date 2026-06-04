import { MuxPlayer } from "@/components/mux-player";
import { VideoTheaterStage } from "@/components/video-theater-stage";
import { LiveOfflineOverlay } from "@/components/live/live-offline-overlay";
import { ScheduleCalendar } from "@/components/live/schedule-calendar";
import { ScheduleWeekList } from "@/components/live/schedule-week-list";

// Public Mux playback ID for the persistent live stream. Overridable via env
// (set NEXT_PUBLIC_MUX_LIVESTREAM_PLAYBACK_ID in Vercel) but defaults to the
// studio's live stream so it works out of the box.
const LIVE_PLAYBACK_ID =
  process.env.NEXT_PUBLIC_MUX_LIVESTREAM_PLAYBACK_ID ??
  "Duyn2ZibZylttGQjR5922VmtybBaRbKTJ3c46XHE8YE";

export default function LivePage() {
  return (
    <div>
      {/* Full-width persistent live video */}
      <VideoTheaterStage>
        <MuxPlayer
          playbackId={LIVE_PLAYBACK_ID}
          title="Move Mindful Live"
          streamType="live"
          fillVideo
          liveOfflineOverlay
          offlineOverlay={<LiveOfflineOverlay />}
        />
      </VideoTheaterStage>

      {/* Recurring weekly schedule — compact list on mobile, full calendar on sm+ */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 pb-12">
        <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Live Schedule
        </h2>

        <div className="sm:hidden">
          <ScheduleWeekList />
        </div>
        <div className="hidden sm:block">
          <ScheduleCalendar />
        </div>
      </div>
    </div>
  );
}
