"use client";

import { PHONE_SHOW_DELAY_MS } from "./coach-tip";

/**
 * What's next, sliding in at the top right of the video as a set nears its
 * end — ten seconds out, on a set that ends by itself (timed, or reps on
 * auto-advance) — with its chime (UP_NEXT in cue-audio.ts), and staying until
 * the set ends. The same slide as the tip bubble, and on phones the same
 * wait, so it lands with its sound. The screen places it; `large` on desktop.
 */
export function UpNextCard({
  show,
  name,
  detail,
  thumbnail,
  large = false,
}: {
  show: boolean;
  name: string;
  detail: string | null;
  thumbnail: string | null;
  large?: boolean;
}) {
  return (
    <>
      {/* Read out as it appears. */}
      <span role="status" className="sr-only">
        {show ? `Up next: ${name}${detail ? `, ${detail}` : ""}` : ""}
      </span>
      <div
        aria-hidden="true"
        className={`pointer-events-none flex items-center rounded-2xl bg-[#14142B]/75 ring-1 ring-white/10 backdrop-blur-md transition-[translate,opacity] motion-reduce:translate-x-0 motion-reduce:transition-opacity ${
          large ? "max-w-[340px] gap-3.5 p-2.5 pr-5" : "max-w-[min(300px,calc(100vw-32px))] gap-3 p-2 pr-4"
        } ${
          show
            ? "translate-x-0 opacity-100 duration-500 ease-[cubic-bezier(0.22,1.3,0.36,1)] starting:translate-x-[calc(100%+48px)] starting:opacity-0"
            : "translate-x-[calc(100%+48px)] opacity-0 duration-300 ease-in"
        }`}
        style={{ transitionDelay: `${show && !large ? PHONE_SHOW_DELAY_MS : 0}ms` }}
      >
        {thumbnail && (
          <span className={`shrink-0 overflow-hidden rounded-lg bg-white/10 ${large ? "h-16 w-12" : "h-14 w-11"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a tiny Mux still; nothing to optimize */}
            <img src={thumbnail} alt="" className="size-full object-cover" />
          </span>
        )}
        <span className={`flex min-w-0 flex-col gap-0.5 ${thumbnail ? "" : "pl-2"}`}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">Up next</span>
          <span className={`truncate font-semibold ${large ? "text-[17px]" : "text-[15px]"}`}>{name}</span>
          {detail && <span className={`truncate text-white/70 ${large ? "text-sm" : "text-[13px]"}`}>{detail}</span>}
        </span>
      </div>
    </>
  );
}
