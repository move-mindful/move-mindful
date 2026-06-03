"use client";

import { useNextClass } from "./use-next-class";

// Content shown over the live player when the stream is offline. Styled
// white-on-black to sit on top of the dark video area.
export function LiveOfflineOverlay() {
  const state = useNextClass();

  return (
    <div className="text-center text-white">
      <p className="text-2xl font-semibold sm:text-3xl">We&apos;ll be back soon!</p>

      {state.status === "upcoming" && (
        <>
          <p className="mt-3 text-lg font-medium sm:text-xl">
            Next class: <strong>{state.title}</strong> on{" "}
            <strong>{state.dayOfWeek}</strong> at{" "}
            <strong>{state.timeLocal}</strong> {state.zoneAbbr}
          </p>
          <p className="mt-1.5 text-sm text-zinc-300">
            Starts in {state.countdown.days}d {state.countdown.hours}h{" "}
            {state.countdown.minutes}m {state.countdown.seconds}s
          </p>
        </>
      )}

      {state.status === "live" && (
        <p className="mt-3 text-lg font-medium sm:text-xl">
          {state.title} is starting — hit Refresh!
        </p>
      )}
    </div>
  );
}
