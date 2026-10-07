"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// ── Workout music: the knobs ──────────────────────────
// One long track, looped, under the whole workout — and on through the
// summary, until Done — while the Audio card's Music switch is on. When
// someone talks — a tutorial, an audio tip, the intro or outro — during the
// warm-up and cool-down, while the workout's paused, and on the summary, it
// dips ("ducks") to a lower level, then comes back up. Every level is its own
// % of the track's loudness, so changing one never moves the others. Tune
// these by ear.

export const MUSIC = {
  /**
   * The track, from apps/web/public: the 30-minute demo music (AAC 128 kbps,
   * converted from the MP3 the user supplied). Null turns music off entirely.
   */
  src: "/audio/workout-music.m4a" as string | null,
  /** Its normal level — exercises, rests, Get ready — as a % of the file's own loudness. */
  volume: 45,
  /**
   * Keep playing (at duckTo.paused) while the workout's paused, instead of
   * stopping. Off for now — the user's call, 2026-10-01; flip to bring it back.
   */
  whilePaused: false,
  /**
   * While each of these is on, the music plays at this % of the file's own
   * loudness instead — like `volume`, and set independently of it.
   */
  duckTo: {
    // Aggressive under the instructor's voice: well below the normal level.
    tutorial: 6,
    tip: 6,
    intro: 12,
    outro: 12,
    warmup: 15,
    cooldown: 15,
    /** Paused in the workout (a set, a tutorial, a held rest or Get ready), when `whilePaused` is on. */
    paused: 6,
    /** The summary (Workout complete), level with the outro before it. */
    done: 12,
  },
  /**
   * Seconds to dip down, and to come back up. Both move evenly in loudness,
   * so coming back (a tutorial ending into Get ready, say) is a smooth rise
   * rather than a jump.
   */
  fadeDown: 0.4,
  fadeUp: 1.5,
};

/** Stopping (the music switched off, the page hidden, the workout over): a quick fade first, so it doesn't click. */
const STOP_FADE = 0.15;

/** Below this a gain is silence: fades to and from it are straight ramps (a loudness-even one can't start or end at zero). */
const SILENT = 0.001;

type Graph = { ctx: AudioContext; gain: GainNode };
type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Move the music's gain to `target` over `seconds`, from wherever it is now
 * (mid-fade included). Between two audible levels it moves evenly in
 * loudness — an exponential ramp, since we hear volume on a log scale —
 * which is what makes a rise sound smooth; a plain setTargetAtTime does most
 * of its rising in the first moment, and sounded like a jump. Fading in from
 * silence, or out to it, is a straight ramp.
 */
function rampTo({ ctx, gain }: Graph, target: number, seconds: number) {
  const param = gain.gain;
  const now = ctx.currentTime;
  const from = param.value;
  if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
  else param.cancelScheduledValues(now);
  param.setValueAtTime(from, now);
  if (from < SILENT || target < SILENT) param.linearRampToValueAtTime(target, now + seconds);
  else param.exponentialRampToValueAtTime(target, now + seconds);
}

// Whether the page is on screen: hidden (another app, the phone locked), the
// music stops even where the workout would keep it playing quietly.
function subscribeToVisibility(change: () => void) {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}

/**
 * The music under the workout. It plays while `on` (the Music switch, and not
 * muted), `playing` (the player wants it — running, or held quietly) and the
 * page is on screen, at `level` (0–1: MUSIC.volume, or a duckTo level); stopping fades
 * it out quickly and pauses it, so it picks up where it was. With `preload`
 * (the workout's preview) and `on`, the track starts loading ahead, so Begin
 * doesn't wait on it.
 *
 * The level goes through Web Audio (the element → a gain → the speakers)
 * because iPhone Safari ignores an audio element's own volume. Both the
 * element and Web Audio need a tap before they can play, so `begin` (the
 * Begin tap: the track from the top) and `wake` (any other tap that should
 * get it going, like switching Music on) set them up and start them;
 * after that it plays and pauses on its own.
 */
export function useWorkoutMusic({
  on,
  playing,
  level,
  preload = false,
}: {
  on: boolean;
  playing: boolean;
  level: number;
  preload?: boolean;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<Graph | null>(null);
  // Mid-start inside a tap: pausing before its play() settles would undo it.
  const unlocking = useRef(false);
  // Restarting after iOS paused it (see `restart`): the pending try, and the recent ones.
  const restartTimer = useRef(0);
  const restarts = useRef<number[]>([]);
  const visible = useSyncExternalStore(subscribeToVisibility, () => !document.hidden, () => true);
  const want = on && playing && visible && !!MUSIC.src;
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
      rampTo(g, target, !want ? STOP_FADE : target < g.gain.gain.value ? MUSIC.fadeDown : MUSIC.fadeUp);
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

  // Ahead of Begin: make the element now, so the track starts loading — the
  // start of the file (its index, then the first of the music) is what has
  // to arrive before it can sound — and Begin's tap only has to play it.
  // Loading needs no tap; playing waits for Begin. Only while the music's
  // on, so a member who's switched it off never downloads it.
  // (After every render, like wantNow above: once the element's made, it's a no-op.)
  const loadAhead = preload && on && !!MUSIC.src;
  useEffect(() => {
    if (loadAhead && !audio.current) element()?.load();
  });

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
