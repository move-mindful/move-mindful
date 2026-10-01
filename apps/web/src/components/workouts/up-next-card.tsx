"use client";

/**
 * What's next, sliding in as a set nears its end — ten seconds out, on a set
 * that ends by itself (timed, or reps on auto-advance) — with its chime
 * (UP_NEXT in cue-audio.ts), and staying until the set ends. It sits a little
 * above the tip bubble's line (a set's tip comes early, so they don't meet),
 * centred on the video, sliding in from past its right edge with the bubble's
 * easing — straight away; the chime follows a moment later (UP_NEXT.soundAfter)
 * so it lands as the card does — in the frosted grey of the player's other
 * controls (the Up next pill). The screen places it, centred in the video
 * column (it uses `--col`); `large` on desktop.
 *
 * `stage`: waiting (off past the right edge), shown, or gone — slid back out
 * past the right edge just before the set ends (UP_NEXT.leaveAt), so it's
 * cleared before the next screen.
 */
export function UpNextCard({
  stage,
  name,
  detail,
  thumbnail,
  large = false,
}: {
  stage: "waiting" | "shown" | "gone";
  name: string;
  detail: string | null;
  thumbnail: string | null;
  large?: boolean;
}) {
  return (
    <>
      {/* Read out as it appears. */}
      <span role="status" className="sr-only">
        {stage === "shown" ? `Up next: ${name}${detail ? `, ${detail}` : ""}` : ""}
      </span>
      <div
        aria-hidden="true"
        className={`pointer-events-none flex items-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md transition-[translate,opacity] motion-reduce:translate-x-0 motion-reduce:transition-opacity ${
          large ? "max-w-[380px] gap-4 p-3 pr-6" : "max-w-[min(340px,calc(100vw-32px))] gap-3.5 p-2.5 pr-5"
        } ${
          stage === "shown"
            ? // From past the video's right edge: half the column, half the card, and a little more.
              "translate-x-0 opacity-100 duration-500 ease-[cubic-bezier(0.22,1.3,0.36,1)] starting:translate-x-[calc(var(--col)/2+50%+8px)] starting:opacity-0"
            : // Waiting, or gone: back out past the right edge, the way it came.
              "translate-x-[calc(var(--col)/2+50%+8px)] opacity-0 duration-300 ease-in"
        }`}
      >
        {thumbnail && (
          <span className={`shrink-0 overflow-hidden rounded-lg bg-white/10 ${large ? "h-[72px] w-14" : "h-16 w-12"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a tiny Mux still; nothing to optimize */}
            <img src={thumbnail} alt="" className="size-full object-cover" />
          </span>
        )}
        <span className={`flex min-w-0 flex-col gap-0.5 ${thumbnail ? "" : "pl-2"}`}>
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70">Up next</span>
          <span className={`truncate font-semibold ${large ? "text-[19px]" : "text-[17px]"}`}>{name}</span>
          {detail && <span className={`truncate text-white/70 ${large ? "text-[15px]" : "text-sm"}`}>{detail}</span>}
        </span>
      </div>
    </>
  );
}
