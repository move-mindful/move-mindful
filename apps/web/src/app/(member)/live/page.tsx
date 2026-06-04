import { LIVE_PLAYBACK_ID } from "@/lib/live-stream-config";
import { VideoTheaterStage } from "@/components/video-theater-stage";
import { LiveStreamPlayer } from "@/components/live/live-stream-player";
import { ScheduleCalendar } from "@/components/live/schedule-calendar";
import { ScheduleWeekList } from "@/components/live/schedule-week-list";

export default function LivePage() {
  return (
    <div>
      {/* Full-width persistent live video */}
      <VideoTheaterStage>
        <LiveStreamPlayer playbackId={LIVE_PLAYBACK_ID} />
      </VideoTheaterStage>

      {/* Recurring weekly schedule — compact list on mobile, full calendar on sm+ */}
      <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-10 pb-12">
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
