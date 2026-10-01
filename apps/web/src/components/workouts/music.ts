"use client";

import { useEffect, useRef } from "react";

// ── Workout music: the knobs ──────────────────────────
// One long track, looped, under the whole workout — and on through the
// summary, until Done — while the Audio card's Music switch is on. When someone talks — a tutorial, an audio tip, the
// intro or outro — and during the warm-up and cool-down, it dips ("ducks")
// to a share of its normal level, then comes back up. Tune these by ear.

export const MUSIC = {
  /**
   * The track, from apps/web/public: the 30-minute demo music (AAC 128 kbps,
   * converted from the MP3 the user supplied). Null turns music off entirely.
   */
  src: "/audio/workout-music.m4a" as string | null,
  /** Its normal level — exercises, rests, Get ready — as a % of the file's own loudness. */
  volume: 60,
  /** While each of these plays, the music drops to this % of its normal level (100 = no dip). */
  duckTo: {
    // Aggressive under the instructor's voice: about 20 dB down.
    tutorial: 10,
    tip: 10,
    intro: 20,
    outro: 20,
    warmup: 35,
    cooldown: 35,
  },
  /** Seconds to dip down, and to come back up. */
  fadeDown: 0.4,
  fadeUp: 1.2,
};

/** Pausing (or the music switched off): a quick fade first, so it doesn't click. */
const STOP_FADE = 0.15;

type Graph = { ctx: AudioContext; gain: GainNode };
type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * The music under the workout. It plays while `on` (the Music switch, and not
 * muted) and `playing` (the workout running), at `level` (0–1: MUSIC.volume,
 * ducked); pausing fades it out quickly and pauses it, so it picks up where
 * it was.
 *
 * The level goes through Web Audio (the element → a gain → the speakers)
 * because iPhone Safari ignores an audio element's own volume. Both the
 * element and Web Audio need a tap before they can play, so `begin` (the
 * Begin tap: the track from the top) and `wake` (any other tap that should
 * get it going, like switching Music on) set them up and start them;
 * after that it plays and pauses on its own.
 */
export function useWorkoutMusic({ on, playing, level }: { on: boolean; playing: boolean; level: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<Graph | null>(null);
  // Mid-start inside a tap: pausing before its play() settles would undo it.
  const unlocking = useRef(false);
  // Restarting after iOS paused it (see `restart`): the pending try, and the recent ones.
  const restartTimer = useRef(0);
  const restarts = useRef<number[]>([]);
  const want = on && playing && !!MUSIC.src;
  const wantNow = useRef(want);

  useEffect(() => {
    wantNow.current = want;
  });

  // Play at the level asked for, easing between levels; or fade out and pause.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const g = graph.current;
    const target = want ? Math.min(1, Math.max(0, level)) : 0;
    if (g) {
      const param = g.gain.gain;
      const now = g.ctx.currentTime;
      const from = param.value;
      const seconds = !want ? STOP_FADE : target < from ? MUSIC.fadeDown : MUSIC.fadeUp;
      param.cancelScheduledValues(now);
      param.setValueAtTime(from, now);
      // Most of the way there (95%) in `seconds`.
      param.setTargetAtTime(target, now, seconds / 3);
    } else {
      a.volume = target; // no Web Audio: the element's own volume (not on iPhones)
    }
    if (want) {
      if (g && g.ctx.state !== "running") g.ctx.resume().catch(() => {});
      a.play().catch(() => {});
      return;
    }
    const timer = window.setTimeout(() => {
      if (!unlocking.current && !wantNow.current) a.pause();
    }, STOP_FADE * 1000 + 50);
    return () => window.clearTimeout(timer);
  }, [want, level]);

  // Leaving the player.
  useEffect(
    () => () => {
      window.clearTimeout(restartTimer.current);
      audio.current?.pause();
      graph.current?.ctx.close().catch(() => {});
    },
    [],
  );

  /**
   * iOS pauses whatever else a page is playing when a video with sound starts
   * — the intro, the warm-up, a tutorial — this music included (or suspends
   * its Web Audio). While the workout still wants it, start it again, once
   * the video's start has settled; music starting doesn't stop the video in
   * turn. Never more than a few times in a few seconds, in case iOS keeps
   * refusing.
   */
  function restart() {
    window.clearTimeout(restartTimer.current);
    restartTimer.current = window.setTimeout(() => {
      if (!wantNow.current) return;
      const now = Date.now();
      restarts.current = restarts.current.filter((t) => now - t < 5000);
      if (restarts.current.length >= 4) return;
      restarts.current.push(now);
      const g = graph.current;
      if (g && g.ctx.state !== "running") g.ctx.resume().catch(() => {});
      audio.current?.play().catch(() => {});
    }, 150);
  }

  /** The element (and its route through Web Audio), made the first time it's needed. */
  function element(): HTMLAudioElement | null {
    if (!MUSIC.src) return null;
    if (audio.current) return audio.current;
    const a = new Audio();
    a.src = MUSIC.src;
    a.loop = true;
    a.preload = "auto";
    // Paused while it's still wanted: not by us (we only pause it when it
    // isn't) — iOS, for a video with sound. Carry on.
    a.onpause = () => {
      if (wantNow.current) restart();
    };
    audio.current = a;
    try {
      const Context = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
      if (Context) {
        const ctx = new Context();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(a).connect(gain).connect(ctx.destination);
        // The same, for its Web Audio being suspended or interrupted.
        ctx.onstatechange = () => {
          if (wantNow.current && ctx.state !== "running" && ctx.state !== "closed") restart();
        };
        graph.current = { ctx, gain };
      }
    } catch {
      graph.current = null; // falls back to the element's volume
    }
    return a;
  }

  /** In a tap: let Web Audio and the element play (silently, until the effect brings it up). */
  function unlock(a: HTMLAudioElement) {
    graph.current?.ctx.resume().catch(() => {});
    if (!a.paused) return;
    unlocking.current = true;
    a.play().then(
      () => {
        unlocking.current = false;
        if (!wantNow.current) a.pause();
      },
      () => {
        unlocking.current = false;
      },
    );
  }

  return {
    /** The Begin tap: the track from the top, fading in. */
    begin() {
      const a = element();
      if (!a) return;
      a.currentTime = 0;
      const g = graph.current;
      if (g) {
        g.gain.gain.cancelScheduledValues(g.ctx.currentTime);
        g.gain.gain.setValueAtTime(0, g.ctx.currentTime);
      }
      unlock(a);
    },
    /** Any other tap that should get the music going (Resume, switching Music on). */
    wake() {
      const a = element();
      if (a) unlock(a);
    },
  };
}
