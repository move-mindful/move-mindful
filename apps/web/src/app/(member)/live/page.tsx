import { MuxPlayer } from "@/components/mux-player";
import { NextClassBanner } from "@/components/live/next-class-banner";
import { ScheduleCalendar } from "@/components/live/schedule-calendar";

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
      <section className="w-full bg-black">
        <div className="mx-auto max-w-6xl">
          <MuxPlayer
            playbackId={LIVE_PLAYBACK_ID}
            title="Move Mindful Live"
            streamType="live"
          />
        </div>
      </section>

      {/* Next-class countdown (personalized to the viewer's local time) */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <NextClassBanner />
      </div>

      {/* Recurring weekly schedule */}
      <div className="mx-auto max-w-6xl px-6 pb-12">
        <ScheduleCalendar />
      </div>
    </div>
  );
}
