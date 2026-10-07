"use client";

import type { ReactNode } from "react";

/**
 * What's next, sliding in as a set nears its end — ten seconds out, on a set
 * that ends by itself (timed, or reps on auto-advance) — with its chime
 * (UP_NEXT in cue-audio.ts), and staying until the set ends. On phones it sits
 * just above the set's info (16px over the superset line, or the reps); on
 * desktop a little above the tip bubble's line (a set's tip comes early, so
 * they rarely meet). Centred on the video, it slides in from past its right edge with the bubble's
 * easing — straight away; the chime follows a moment later (UP_NEXT.soundAfter)
 * so it lands as the card does — in the frosted grey of the player's other
 * controls (the Up next pill). The screen places it, centred in the video
 * column (it uses `--col`); `large` on desktop. Its width is set, not the
 * name's — the width of the column inside its 20px gutters on phones, 380px on
 * desktop, as the rest screen's card is — so it doesn't change size from one
 * exercise to the next; a name too long for it is cut short.
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
  icon = null,
  large = false,
}: {
  stage: "waiting" | "shown" | "gone";
  name: string;
  detail: string | null;
  thumbnail: string | null;
  /** In the thumbnail's place when there's none: a rest's timer. */
  icon?: ReactNode;
  large?: boolean;
}) {
  return (
    <>
      {/* Read out as it appears. */}
      <span role="status" className="sr-only">
        {stage === "shown" ? `Up next: ${name}${detail ? `, ${detail}` : ""}` : ""}
      </span>
      <NextCard
        name={name}
        detail={detail}
        thumbnail={thumbnail}
        icon={icon}
        large={large}
        hidden
        className={`pointer-events-none transition-[translate,opacity] motion-reduce:translate-x-0 motion-reduce:transition-opacity ${
          large ? "w-[380px] max-w-[calc(100%-40px)]" : "w-full"
        } ${
          stage === "shown"
            ? // From past the video's right edge: half the column, half the card, and a little more.
              "translate-x-0 opacity-100 duration-500 ease-[cubic-bezier(0.22,1.3,0.36,1)] starting:translate-x-[calc(var(--col)/2+50%+8px)] starting:opacity-0"
            : // Waiting, or gone: back out past the right edge, the way it came.
              "translate-x-[calc(var(--col)/2+50%+8px)] opacity-0 duration-300 ease-in"
        }`}
      />
    </>
  );
}

/**
 * The frosted card itself — a still (or an icon), its label, the name and a
 * detail line — shared by the Up next card and the rest screen's. The caller
 * sets its width (and anything else) with `className`; `hidden` keeps it from
 * screen readers when something else reads it out.
 */
export function NextCard({
  label = "Up next",
  name,
  detail,
  thumbnail,
  icon = null,
  large = false,
  hidden = false,
  className = "",
}: {
  label?: string;
  name: string;
  detail: string | null;
  thumbnail: string | null;
  icon?: ReactNode;
  large?: boolean;
  hidden?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className={`flex items-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md ${
        large ? "gap-4 p-3 pr-6" : "gap-3.5 p-2.5 pr-5"
      } ${className}`}
    >
      {(thumbnail || icon) && (
        <span
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-[#A99CFF] ${
            large ? "h-[72px] w-14" : "h-16 w-12"
          }`}
        >
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- a tiny Mux still; nothing to optimize
            <img src={thumbnail} alt="" className="size-full object-cover" />
          ) : (
            icon
          )}
        </span>
      )}
      <span className={`flex min-w-0 flex-col gap-0.5 ${thumbnail || icon ? "" : "pl-2"}`}>
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70">{label}</span>
        <span className={`truncate font-semibold ${large ? "text-[19px]" : "text-[17px]"}`}>{name}</span>
        {detail && <span className={`truncate text-white/70 ${large ? "text-[15px]" : "text-sm"}`}>{detail}</span>}
      </span>
    </div>
  );
}
