"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";

// Cues: short clips the player plays a set time into a step — the
// instructor's audio tips (with their bubble, coach-tip.tsx), the voice
// announcements, the countdown over the last seconds of a rest or Get ready,
// the Up next chime, and the start sound as an exercise begins.

/**
 * The countdown over the last seconds of a rest or Get ready — a sound
 * effect (the Audio card's switch): three counts a second apart, each
 * starting 0.1 s into its second, so started with `seconds` left they land on
 * 3, 2, 1 as the timer shows them and finish as it ends. A shorter one gets
 * just its end.
 */
export const COUNTDOWN = {
  /** At 90% of the level supplied (the file itself: iPhones ignore an element's volume). */
  src: "/audio/countdown.m4a",
  /** The file's length. */
  seconds: 3.03,
  /** Start it this much earlier (seconds) if the counts land late on a phone. */
  lead: 0,
};

/**
 * The Up next chime — a sound effect — played as the Up next card slides in,
 * `before` seconds from the end of a set that ends by itself (UpNextCard).
 * A set no longer than that doesn't get it.
 */
export const UP_NEXT = {
  /** At 90% of the level supplied, like the countdown. */
  src: "/audio/upnext.mp3",
  before: 10,
  /** The chime waits this long (seconds) after the card starts sliding in, so it lands as the card does. */
  soundAfter: 0.15,
  /** With this long (seconds) left, the card slides back out to the right, gone as the set ends. */
  leaveAt: 0.6,
  /** A rest this long (seconds) or longer is what the card and pill name next — Rest and its time — rather than the set after it. */
  restFrom: 20,
};

/**
 * The start sound — a sound effect — as an exercise begins: when its name and
 * the dim over it lift (BeginCard), after its voice announcement, as its
 * countdown starts. Not on rests.
 */
export const EXERCISE_START = {
  /** Switched off for now (Oct 2026, the owner's call); `true` brings it back. */
  on: false,
  /** As supplied (Oct 2026): a 0.21 s blip, sound from its very start. */
  src: "/audio/exercise-start.mp3",
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
 * `playing`: the cue is audibly playing (the music dips while it is).
 * `held`: it's been paused part-way by a pause or a sheet, and will carry on
 * when the workout does (a tip's bubble stays on screen through it).
 * `time()`: how far into its file the cue is, in seconds (a tip's equalizer
 * bars follow its voice by it) — for animation frames, not render.
 *
 * `volume` (0–1, default full) is the element's own volume, which iPhone
 * Safari ignores (the music goes through Web Audio for that).
 *
 * `local` gives a downloaded copy of a file, if there is one (usePrefetched),
 * to play instead of fetching it: asked as each step loads its cue, so a copy
 * that arrives part-way through a step doesn't restart it.
 */
export function useCueAudio({
  clip,
  take,
  running,
  delayMs,
  muted,
  volume = 1,
  local,
}: {
  clip: { url: string; start: number; end: number | null } | null;
  take: number;
  running: boolean;
  delayMs: number;
  muted: boolean;
  volume?: number;
  local?: (url: string) => string | undefined;
}): { playing: boolean; held: boolean; time: () => number; unlock: () => void } {
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
  // The take whose cue is audibly playing, from the element's own events; and
  // the take whose cue is held part-way, for the workout pausing.
  const [speakingTake, setSpeakingTake] = useState<number | null>(null);
  const [heldTake, setHeldTake] = useState<number | null>(null);
  // Pausing it for the workout pausing (not for its end, a new step or mute).
  const holding = useRef(false);
  const on = useRef({
    playing: () => {
      setSpeakingTake(loaded.current);
      setHeldTake(null);
    },
    paused: () => {
      setSpeakingTake(null);
      setHeldTake(holding.current ? loaded.current : null);
      holding.current = false;
    },
    ended: () => {
      if (progress.current.take === loaded.current) progress.current.done = true;
      setSpeakingTake(null);
      setHeldTake(null);
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

  const source = useEffectEvent((u: string) => local?.(u) ?? u);

  // Its level — set on the element whenever there is one (made for the first
  // cue, or in the Begin tap).
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
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
      a.src = source(url);
    }
  }, [take, url, start, end]);

  // Count down to the cue while running; hold (and pause it) otherwise.
  useEffect(() => {
    const a = audio.current;
    const p = progress.current;
    if (!url || !a || p.take !== take || p.done) return;
    if (!running) {
      if (!a.paused) {
        holding.current = true;
        a.pause();
      }
      return;
    }
    if (p.started) {
      if (muted) a.pause();
      else a.play().catch(() => setHeldTake(null));
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

  const time = useCallback(() => audio.current?.currentTime ?? 0, []);

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

  return {
    playing: speakingTake !== null && speakingTake === take,
    // Muted while held, it won't carry on.
    held: heldTake !== null && heldTake === take && !muted,
    time,
    unlock,
  };
}

/**
 * Downloads these files ahead — the voice announcements of the next few
 * steps — and gives back a local copy of each once it's in (for
 * useCueAudio's `local`), so a cue due the moment its step begins starts then
 * rather than after a download. Copies last as long as the player (a line is
 * about 30 KB); one that fails plays from the network, and is tried again
 * when it's next asked for.
 */
export function usePrefetched(urls: string[]): (url: string) => string | undefined {
  const [copies, setCopies] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const made = useRef<string[]>([]);
  const list = urls.join("\n");
  useEffect(() => {
    for (const url of list ? list.split("\n") : []) {
      if (asked.current.has(url)) continue;
      asked.current.add(url);
      fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
        .then((blob) => {
          const copy = URL.createObjectURL(blob);
          made.current.push(copy);
          setCopies((c) => ({ ...c, [url]: copy }));
        })
        .catch(() => asked.current.delete(url));
    }
  }, [list]);
  // Leaving the player: let the copies go.
  useEffect(() => {
    const all = made.current;
    return () => all.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  return useCallback((url: string) => copies[url], [copies]);
}
