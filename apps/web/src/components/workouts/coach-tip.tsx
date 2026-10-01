"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sound } from "./icons";

/**
 * The instructor's audio tips in the player. A moment into a set or rest that
 * has one, the tip plays and the instructor's photo slides in at the bottom
 * right of the video, ringed by equalizer bars, sliding away when it ends.
 * The bars don't follow the audio; they only say a voice is playing.
 * Recorded in the builder's Audio tips view (TipMap in core).
 */

/** A tenth of a second of silence (8 kHz, 8-bit mono WAV), to unlock the audio element with. */
function silentWav(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence sits at the midpoint
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}

/** The tips' audio element, reporting what it does to `on`. */
function newTipAudio(on: {
  playing: () => void;
  paused: () => void;
  ended: () => void;
  time: () => void;
  loaded: () => void;
}): HTMLAudioElement {
  const a = new Audio();
  a.preload = "auto";
  a.onplaying = () => on.playing();
  a.onpause = () => on.paused();
  a.onended = () => on.ended();
  a.ontimeupdate = () => on.time();
  a.onloadedmetadata = () => on.loaded();
  return a;
}

/**
 * Plays the tip for the step on screen, through one <audio> element kept for
 * the whole workout. `unlock` goes in the Begin tap: iOS lets an element that
 * has played during a tap play again later without one (the video pool's
 * trick too), so tips can start on their own.
 *
 * A tip starts `delayMs` into its step, counting only while `running`, so a
 * pause or a sheet holds the count — and pauses a tip mid-way, to carry on
 * after. A new `take` (the next step, a restart) stops it: a tip never runs
 * past its set or rest. With instructor audio off (`muted`) a tip that comes
 * due is skipped, and one playing pauses until it's turned back on.
 *
 * A trimmed tip plays just its speech: from `start` to `end` (seconds into
 * the file; null plays to the file's end), so the dead air either side never
 * plays — and the bubble leaves with the last word.
 *
 * `speaking`: a tip is audibly playing, for CoachTip.
 */
export function useTipAudio({
  tip,
  take,
  running,
  delayMs,
  muted,
}: {
  tip: { url: string; start: number; end: number | null } | null;
  take: number;
  running: boolean;
  delayMs: number;
  muted: boolean;
}): { speaking: boolean; unlock: () => void } {
  const url = tip?.url ?? null;
  const start = tip?.start ?? 0;
  const end = tip?.end ?? null;
  const audio = useRef<HTMLAudioElement | null>(null);
  // The part of the file the tip on screen plays.
  const bounds = useRef({ start, end });
  // This take's running time so far, and whether its tip has started or is over.
  const progress = useRef({ take, ms: 0, started: false, done: false });
  // The take whose tip the element holds, and whether instructor audio is off right now.
  const loaded = useRef<number | null>(null);
  const mutedNow = useRef(muted);
  // Mid-unlock: pausing before its play() settles would undo it (as in the video pool).
  const unlocking = useRef(false);
  // The take whose tip is audibly playing, from the element's own events.
  const [speakingTake, setSpeakingTake] = useState<number | null>(null);
  const on = useRef({
    playing: () => setSpeakingTake(loaded.current),
    paused: () => setSpeakingTake(null),
    ended: () => {
      if (progress.current.take === loaded.current) progress.current.done = true;
      setSpeakingTake(null);
    },
    // At the end of the speech: stop, as if the file had ended there.
    time: () => {
      const a = audio.current;
      const stop = bounds.current.end;
      if (!a || a.paused || stop === null || a.currentTime < stop) return;
      if (progress.current.take === loaded.current) progress.current.done = true;
      a.pause();
    },
    // Started before the file's details had loaded: make sure it's at the speech.
    loaded: () => {
      const a = audio.current;
      if (a && progress.current.started && a.currentTime + 0.05 < bounds.current.start) a.currentTime = bounds.current.start;
    },
  });

  useEffect(() => {
    mutedNow.current = muted;
  });

  // A new step (or take): stop whatever was playing and load this one's tip.
  useEffect(() => {
    progress.current = { take, ms: 0, started: false, done: false };
    bounds.current = { start, end };
    if (url && !audio.current) audio.current = newTipAudio(on.current);
    const a = audio.current;
    if (!a) return;
    if (!unlocking.current) a.pause();
    if (url) {
      loaded.current = take;
      a.src = url;
    }
  }, [take, url, start, end]);

  // Count down to the tip while running; hold (and pause it) otherwise.
  useEffect(() => {
    const a = audio.current;
    const p = progress.current;
    if (!url || !a || p.take !== take || p.done) return;
    if (!running) {
      if (!a.paused) a.pause();
      return;
    }
    if (p.started) {
      if (muted) a.pause();
      else a.play().catch(() => {});
      return;
    }
    const since = performance.now();
    const timer = window.setTimeout(
      () => {
        p.started = true;
        if (mutedNow.current) {
          p.done = true;
          return;
        }
        a.currentTime = bounds.current.start;
        a.play().catch(() => {
          p.done = true;
        });
      },
      Math.max(0, delayMs - p.ms),
    );
    return () => {
      window.clearTimeout(timer);
      p.ms += performance.now() - since;
    };
  }, [take, url, running, muted, delayMs]);

  // Leaving the player.
  useEffect(() => () => audio.current?.pause(), []);

  function unlock() {
    audio.current ??= newTipAudio(on.current);
    const a = audio.current;
    const silent = silentWav();
    loaded.current = null;
    a.src = silent;
    unlocking.current = true;
    a.play().then(
      () => {
        unlocking.current = false;
        // Only if a tip hasn't taken the element over meanwhile.
        if (a.src === silent) a.pause();
      },
      () => {
        unlocking.current = false;
      },
    );
  }

  return { speaking: speakingTake !== null && speakingTake === take, unlock };
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
 * box is the whole ring, bars included; the screen places it. `large` on
 * desktop. Without a photo, the instructor's initial (or a speaker) instead.
 */
export function CoachTip({
  show,
  instructor,
  large = false,
}: {
  show: boolean;
  instructor: { name: string; photoUrl: string | null } | null;
  large?: boolean;
}) {
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
