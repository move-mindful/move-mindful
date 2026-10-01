"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import ayla from "./instructor-ayla.webp";

/**
 * Instructor audio tips — the look, before the tips themselves exist. A few
 * seconds into an exercise the instructor's photo slides in at the bottom
 * right of the video, ringed by equalizer bars while they talk, then slides
 * away. The bars don't follow the audio; they only say a voice is playing.
 * Until tips have recordings (and a place in the builder), the player fires a
 * silent stand-in on every set — see useCoachTip.
 */

/** How far into the exercise the tip starts, and how long it plays. */
export const TIP_DELAY_MS = 3000;
export const TIP_LENGTH_MS = 6000;

/**
 * Whether the tip is playing: from TIP_DELAY_MS into the exercise for
 * TIP_LENGTH_MS, counting only while `running`, so a pause (or a sheet over
 * the video) holds it where it was. A new `take` — the next set, a restart —
 * starts the count again.
 */
export function useCoachTip(take: number, running: boolean): boolean {
  const clock = useRef({ take, ms: 0 });
  // The take whose tip is playing right now, if any.
  const [playing, setPlaying] = useState<number | null>(null);

  useEffect(() => {
    if (clock.current.take !== take) clock.current = { take, ms: 0 };
    if (!running) return;
    const since = performance.now();
    const at = clock.current.ms;
    const timers: number[] = [];
    if (at < TIP_DELAY_MS) timers.push(window.setTimeout(() => setPlaying(take), TIP_DELAY_MS - at));
    if (at < TIP_DELAY_MS + TIP_LENGTH_MS) {
      timers.push(window.setTimeout(() => setPlaying(null), TIP_DELAY_MS + TIP_LENGTH_MS - at));
    }
    return () => {
      clock.current.ms += performance.now() - since;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [take, running]);

  return running && playing === take;
}

const BARS = 36;

/** A steady scatter in 0–1, so the bars differ from each other but not between renders. */
function scatter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Each bar's own speed, head start and reach: quick and uneven, like speech.
const RHYTHM = Array.from({ length: BARS }, (_, i) => ({
  seconds: 0.34 + scatter(i, 1) * 0.46,
  delay: -scatter(i, 2),
  reach: 0.62 + scatter(i, 3) * 0.38,
}));

/**
 * The instructor's photo in a ring of equalizer bars. Shown, it slides in
 * from the right (past the edge of the video, which clips it) and the ring
 * grows in; hidden, the ring goes first and the photo slides back out. Its
 * box is the whole ring, bars included; the screen places it. `large` on desktop.
 */
export function CoachTip({ show, large = false }: { show: boolean; large?: boolean }) {
  const photo = large ? 64 : 48;
  const gap = large ? 4 : 3;
  const bar = large ? 13 : 10;
  const size = photo + 2 * (gap + bar);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative transition-[translate,opacity] motion-reduce:translate-x-0 motion-reduce:transition-opacity ${
        show
          ? // In with a little overshoot, then the ring; mounting already shown (back from pause), it still slides in.
            "translate-x-0 opacity-100 duration-500 ease-[cubic-bezier(0.22,1.3,0.36,1)] starting:translate-x-[calc(100%+48px)] starting:opacity-0"
          : "translate-x-[calc(100%+48px)] opacity-0 delay-200 duration-300 ease-in"
      }`}
      style={{ width: size, height: size }}
    >
      {/* A soft dark disc, so the bars read over a bright studio. */}
      <div className="absolute inset-0 rounded-full bg-[#0E0E20]/40 backdrop-blur-sm" />
      <div
        className={`absolute inset-0 transition-[scale,opacity] duration-300 ${
          show ? "scale-100 opacity-100 delay-300 starting:scale-75 starting:opacity-0" : "scale-75 opacity-0"
        }`}
      >
        {RHYTHM.map((r, i) => (
          <div key={i} className="absolute inset-0" style={{ rotate: `${(360 / BARS) * i}deg` }}>
            <span
              // Hidden, the bars stop where they are (the voice has ended) as the ring fades.
              className={`absolute left-1/2 origin-bottom rounded-full bg-[#A99CFF] animate-[coach-eq_var(--s)_ease-in-out_var(--d)_infinite_alternate] motion-reduce:animate-none motion-reduce:scale-y-60 ${
                show ? "" : "[animation-play-state:paused]"
              }`}
              style={
                {
                  "--s": `${r.seconds}s`,
                  "--d": `${r.delay}s`,
                  width: large ? 3.5 : 3,
                  marginLeft: large ? -1.75 : -1.5,
                  height: bar * r.reach,
                  bottom: `calc(50% + ${photo / 2 + gap}px)`,
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
      <Image
        src={ayla}
        alt=""
        width={photo}
        height={photo}
        loading="eager"
        className="absolute rounded-full object-cover ring-2 ring-white/85"
        style={{ width: photo, height: photo, left: gap + bar, top: gap + bar }}
      />
    </div>
  );
}
