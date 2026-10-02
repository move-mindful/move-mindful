"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * The pops for the fireworks on Workout complete (Fireworks in
 * player-screens.tsx): a sound effect, like the countdown, so off with the
 * Audio card's Sound effects (or Mute all). Five recordings, cut from one file
 * the user supplied so each starts 5 ms before its crack. Each burst plays one
 * at random (not the one just played), panned toward the firework's side of
 * the screen, its level and pitch nudged so the repeats don't sound copied.
 */
export const FIREWORK_SOUNDS = {
  srcs: [1, 2, 3, 4, 5].map((n) => `/audio/firework-${n}.m4a`),
  /** Their level, as a % of the files' own loudness (the music's at 12% on the summary). 50 was a touch loud. */
  volume: 37.5,
  /** How far each pop's level and pitch may stray from the file's, either way (0.2 = 20%). */
  levelSpread: 0.2,
  pitchSpread: 0.06,
  /** How far a firework at the screen's edge pans to that side (0 = centre, 1 = all the way). */
  pan: 0.6,
};

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Plays the fireworks' pops through Web Audio, so they can overlap, pan and
 * start on the dot. Like every sound in the player it needs a tap first:
 * `unlock` (in the Begin or Resume tap) sets it up, since the summary can come
 * up with no tap of its own. The pops are only fetched while `on`.
 */
export function useFireworkSounds(on: boolean): {
  unlock: () => void;
  /** A pop `inSeconds` from now, for a firework `x`% across the screen. */
  play: (x: number, inSeconds: number) => void;
  /** Silence every pop playing or still to come (leaving the summary). */
  stop: () => void;
} {
  const ctx = useRef<AudioContext | null>(null);
  const buffers = useRef<Array<AudioBuffer | null>>([]);
  const loading = useRef(false);
  const last = useRef(-1);
  const onNow = useRef(on);
  // Pops playing, or scheduled for a burst still to come.
  const pending = useRef(new Set<AudioBufferSourceNode>());

  const load = useCallback(() => {
    const c = ctx.current;
    if (!c || loading.current) return;
    loading.current = true;
    buffers.current = FIREWORK_SOUNDS.srcs.map(() => null);
    FIREWORK_SOUNDS.srcs.forEach((src, i) => {
      fetch(src)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.statusText))))
        .then((data) => c.decodeAudioData(data))
        .then((buffer) => {
          buffers.current[i] = buffer;
        })
        .catch(() => {
          // That pop stays out of the draw; the others still play.
        });
    });
  }, []);

  const stop = useCallback(() => {
    for (const source of pending.current) {
      try {
        source.stop();
      } catch {
        // already over
      }
    }
    pending.current.clear();
  }, []);

  // Sound effects switched off (or Mute all) mid-show: quiet at once.
  useEffect(() => {
    onNow.current = on;
    if (on) load();
    else stop();
  }, [on, load, stop]);

  // Leaving the player. Forget the context too, so a later tap makes a new one.
  useEffect(
    () => () => {
      const c = ctx.current;
      ctx.current = null;
      loading.current = false;
      pending.current.clear();
      c?.close().catch(() => {});
    },
    [],
  );

  const unlock = useCallback(() => {
    try {
      if (!ctx.current) {
        const Context = window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
        if (!Context) return;
        ctx.current = new Context();
      }
      const c = ctx.current;
      c.resume().catch(() => {});
      // Older iPhones only unlock Web Audio for a sound actually started in the tap.
      const silence = c.createBufferSource();
      silence.buffer = c.createBuffer(1, 1, c.sampleRate);
      silence.connect(c.destination);
      silence.start();
      if (onNow.current) load();
    } catch {
      ctx.current = null; // no pops, nothing else affected
    }
  }, [load]);

  const play = useCallback((x: number, inSeconds: number) => {
    const c = ctx.current;
    if (!c || !onNow.current || document.hidden) return;
    const ready = buffers.current.flatMap((b, i) => (b ? [i] : []));
    if (!ready.length) return;
    const choices = ready.length > 1 ? ready.filter((i) => i !== last.current) : ready;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    last.current = pick;
    if (c.state !== "running") c.resume().catch(() => {});

    const nudge = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;
    const source = c.createBufferSource();
    source.buffer = buffers.current[pick];
    source.playbackRate.value = nudge(FIREWORK_SOUNDS.pitchSpread);
    const gain = c.createGain();
    gain.gain.value = (FIREWORK_SOUNDS.volume / 100) * nudge(FIREWORK_SOUNDS.levelSpread);
    let node: AudioNode = source;
    if (typeof c.createStereoPanner === "function") {
      const panner = c.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (x / 50 - 1) * FIREWORK_SOUNDS.pan));
      node = node.connect(panner);
    }
    node.connect(gain).connect(c.destination);
    pending.current.add(source);
    source.onended = () => pending.current.delete(source);
    source.start(c.currentTime + Math.max(0, inSeconds));
  }, []);

  return { unlock, play, stop };
}
