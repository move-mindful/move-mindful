"use client";

import { useEffect, useRef, useState } from "react";

// Cues: short clips the player plays a set time into a step — the
// instructor's audio tips (with their bubble, coach-tip.tsx), and the
// countdown over a rest's last seconds.

/**
 * The rest countdown — a sound effect (the Audio card's switch): three counts
 * a second apart, each starting 0.1 s into its second, so started with
 * `seconds` of rest left they land on 3, 2, 1 as the timer shows them and
 * finish as the rest ends. A rest shorter than that gets just its end.
 */
export const COUNTDOWN = {
  src: "/audio/countdown.m4a",
  /** The file's length. */
  seconds: 3.03,
  /** Start it this much earlier (seconds) if the counts land late on a phone. */
  lead: 0,
};

/** A tenth of a second of silence (8 kHz, 8-bit mono WAV), to unlock an audio element with. */
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

/** A cue's audio element, reporting what it does to `on`. */
function newCueAudio(on: {
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
 * Plays a cue for the step on screen — an audio tip, or the rest's countdown
 * — through one <audio> element of its own, kept for the whole workout.
 * `unlock` goes in the Begin tap: iOS lets an element that has played during
 * a tap play again later without one (the video pool's trick too), so cues
 * can start on their own.
 *
 * A cue starts `delayMs` into its step, counting only while `running`, so a
 * pause or a sheet holds the count — and pauses a cue mid-way, to carry on
 * after. A new `take` (the next step, a restart) stops it: a cue never runs
 * past its set or rest. Off (`muted`), a cue that comes due is skipped, and
 * one playing pauses until it's turned back on.
 *
 * `clip` plays from `start` to `end` (seconds into the file; null: to its
 * end) — a trimmed tip's speech, or the part of the countdown a short rest
 * has room for.
 *
 * `playing`: the cue is audibly playing (a tip's bubble shows while it is).
 */
export function useCueAudio({
  clip,
  take,
  running,
  delayMs,
  muted,
}: {
  clip: { url: string; start: number; end: number | null } | null;
  take: number;
  running: boolean;
  delayMs: number;
  muted: boolean;
}): { playing: boolean; unlock: () => void } {
  const url = clip?.url ?? null;
  const start = clip?.start ?? 0;
  const end = clip?.end ?? null;
  const audio = useRef<HTMLAudioElement | null>(null);
  // The part of the file the cue on screen plays.
  const bounds = useRef({ start, end });
  // This take's running time so far, and whether its cue has started or is over.
  const progress = useRef({ take, ms: 0, started: false, done: false });
  // The take whose cue the element holds, and whether it's muted right now.
  const loaded = useRef<number | null>(null);
  const mutedNow = useRef(muted);
  // Mid-unlock: pausing before its play() settles would undo it (as in the video pool).
  const unlocking = useRef(false);
  // The take whose cue is audibly playing, from the element's own events.
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

  // A new step (or take): stop whatever was playing and load this one's cue.
  useEffect(() => {
    progress.current = { take, ms: 0, started: false, done: false };
    bounds.current = { start, end };
    if (url && !audio.current) audio.current = newCueAudio(on.current);
    const a = audio.current;
    if (!a) return;
    if (!unlocking.current) a.pause();
    if (url) {
      loaded.current = take;
      a.src = url;
    }
  }, [take, url, start, end]);

  // Count down to the cue while running; hold (and pause it) otherwise.
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
    audio.current ??= newCueAudio(on.current);
    const a = audio.current;
    const silent = silentWav();
    loaded.current = null;
    a.src = silent;
    unlocking.current = true;
    a.play().then(
      () => {
        unlocking.current = false;
        // Only if a cue hasn't taken the element over meanwhile.
        if (a.src === silent) a.pause();
      },
      () => {
        unlocking.current = false;
      },
    );
  }

  return { playing: speakingTake !== null && speakingTake === take, unlock };
}
