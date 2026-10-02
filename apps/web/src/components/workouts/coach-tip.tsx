"use client";

import type { CSSProperties } from "react";
import { Sound } from "./icons";

/**
 * The instructor's audio tips in the player. A moment into a set or rest that
 * has one, the tip plays and the instructor's photo slides in at the bottom
 * right of the video, ringed by equalizer bars, sliding away when it ends.
 * The bars don't follow the audio; they only say a voice is playing.
 * Recorded in the builder's Audio tips view (TipMap in core); played by
 * useCueAudio (cue-audio.ts).
 */

const BARS = 48;

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

/** The dark disc's fade: solid to 65% of the way out, then easing to clear at its edge. */
const DISC_FADE = "radial-gradient(closest-side, #000 65%, transparent)";

/**
 * How long the bubble waits, once a tip starts playing, before sliding in —
 * on phones, where the sound itself can take about that long to come out of
 * the speaker after it starts (iOS starting its audio). Desktop's sound is
 * near-instant, so there it doesn't wait. Tune by ear.
 */
const PHONE_SHOW_DELAY_MS = 500;

/**
 * The instructor's photo in a ring of equalizer bars. Shown, it slides in
 * from the right (past the edge of the video, which clips it) and the ring
 * grows in; hidden, the ring goes first and the photo slides back out. Its
 * box is the whole ring, bars included; the screen places it. `large` on
 * desktop. Without a photo, the instructor's initial (or a speaker) instead.
 *
 * `held`: the tip's paused part-way with the workout. The bubble stays put
 * with its bars still, and — back on screen after the pause screen — is
 * simply there again rather than sliding in a second time.
 */
export function CoachTip({
  show,
  held = false,
  instructor,
  large = false,
}: {
  show: boolean;
  held?: boolean;
  instructor: { name: string; photoUrl: string | null } | null;
  large?: boolean;
}) {
  const photo = large ? 64 : 48;
  const gap = large ? 4 : 3;
  const bar = large ? 13 : 10;
  const barWidth = large ? 2.5 : 2;
  const size = photo + 2 * (gap + bar);
  // In: after the phone's wait, then the ring 300 ms behind the photo. Out: the ring first, the photo 200 ms after.
  const wait = large ? 0 : PHONE_SHOW_DELAY_MS;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative transition-[translate,opacity] motion-reduce:translate-x-0 motion-reduce:transition-opacity ${
        show
          ? // In with a little overshoot, then the ring. Back from the pause screen mid-tip (held), already in place.
            `translate-x-0 opacity-100 duration-500 ease-[cubic-bezier(0.22,1.3,0.36,1)] ${
              held ? "" : "starting:translate-x-[calc(100%+48px)] starting:opacity-0"
            }`
          : "translate-x-[calc(100%+48px)] opacity-0 duration-300 ease-in"
      }`}
      style={{ width: size, height: size, transitionDelay: `${show ? wait : 200}ms` }}
    >
      {/* A soft dark disc, so the bars read over a bright studio: a little wider
          than the ring, solid behind the photo and fading out toward its edge. */}
      <div
        className="absolute -inset-2 rounded-full bg-[#0E0E20]/40 backdrop-blur-sm"
        style={{ maskImage: DISC_FADE, WebkitMaskImage: DISC_FADE }}
      />
      <div
        className={`absolute inset-0 transition-[scale,opacity] duration-300 ${
          show ? `scale-100 opacity-100 ${held ? "" : "starting:scale-75 starting:opacity-0"}` : "scale-75 opacity-0"
        }`}
        style={{ transitionDelay: `${show ? wait + 300 : 0}ms` }}
      >
        {RHYTHM.map((r, i) => (
          <div key={i} className="absolute inset-0" style={{ rotate: `${(360 / BARS) * i}deg` }}>
            <span
              // Hidden, the bars stop where they are (the voice has ended) as the ring fades; held, until it carries on.
              className={`absolute left-1/2 origin-bottom rounded-full bg-[#A99CFF] animate-[coach-eq_var(--s)_ease-in-out_var(--d)_infinite_alternate] motion-reduce:animate-none motion-reduce:scale-y-60 ${
                show && !held ? "" : "[animation-play-state:paused]"
              }`}
              style={
                {
                  "--s": `${r.seconds}s`,
                  "--d": `${r.delay}s`,
                  width: barWidth,
                  marginLeft: -barWidth / 2,
                  height: bar * r.reach,
                  bottom: `calc(50% + ${photo / 2 + gap}px)`,
                } as CSSProperties
              }
            />
          </div>
        ))}
      </div>
      {instructor?.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small avatar from Storage; nothing to optimize
        <img
          src={instructor.photoUrl}
          alt=""
          className="absolute rounded-full object-cover ring-2 ring-white/85"
          style={{ width: photo, height: photo, left: gap + bar, top: gap + bar }}
        />
      ) : (
        <span
          className="absolute flex items-center justify-center rounded-full bg-[#A99CFF] font-semibold text-[#14142B] ring-2 ring-white/85"
          style={{ width: photo, height: photo, left: gap + bar, top: gap + bar, fontSize: photo * 0.42 }}
        >
          {instructor?.name.trim().charAt(0).toUpperCase() || <Sound />}
        </span>
      )}
    </div>
  );
}
