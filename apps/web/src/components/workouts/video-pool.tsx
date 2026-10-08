"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * The player's videos: a fixed pool of <video> elements, each holding one clip.
 * The clip on screen and the next few are loaded ahead so moving on shows a
 * frame at once; when the workout moves past a clip its element is reused for
 * one further ahead.
 *
 * A fixed pool rather than one element per clip because of iOS: a video may
 * only start with sound after being played during a tap. Every element is
 * "unlocked" that way on the Begin tap, and stays unlocked when its clip
 * changes — so a tutorial can start with sound after a timed set ends on its
 * own, with no tap. (Tested in the playback lab, plan.md Phase 4.5 step 1.)
 */

export interface PoolClip {
  url: string;
  poster: string;
}

export const POOL_SIZE = 4;

/**
 * At a cut from one clip to another, the one we're leaving stays on screen —
 * paused where it was — until the new one is actually playing, then it's
 * swapped in (still a cut). A paused, hidden video can take a moment to put
 * its first frame up again, iPhones especially, and showing it straight away
 * flashed the black stage behind. Never held longer than this (ms): a clip
 * still loading then shows its spinner as before.
 */
const HANDOFF_MAX_MS = 1500;

export interface ShownClip extends PoolClip {
  loop: boolean;
  /** Always plays muted, whatever the sound setting: an exercise's loop. */
  silent: boolean;
}

export interface VideoPool {
  /** Ref callbacks for the pool's <video> elements. */
  refs: Array<(el: HTMLVideoElement | null) => void>;
  /**
   * Load `upcoming` (in order, the shown clip first) into the pool, and show
   * and play (or pause) `shown`. `take` changing starts the shown clip from the
   * beginning.
   */
  sync: (upcoming: PoolClip[], shown: ShownClip | null, opts: { playing: boolean; muted: boolean; take: number }) => void;
  /** During the Begin tap: play and pause every loaded clip so later clips may play with sound. */
  unlock: () => void;
  /** The element on screen, for reading its time. */
  current: () => HTMLVideoElement | null;
}

export function useVideoPool({
  onEnded,
  onSoundBlocked,
  onBuffering,
}: {
  /** The clip on screen reached its end (only clips that don't loop do). */
  onEnded: () => void;
  /** A clip couldn't start with sound, so it was started muted instead. */
  onSoundBlocked: () => void;
  /** The clip on screen should be playing but is waiting for data (true), or is playing again (false). */
  onBuffering: (waiting: boolean) => void;
}): VideoPool {
  const els = useRef<Array<HTMLVideoElement | null>>([]);
  const shown = useRef<HTMLVideoElement | null>(null);
  // A cut under way (see HANDOFF_MAX_MS): `from` still up, `to` playing hidden until it's going.
  const handoff = useRef<{ from: HTMLVideoElement; to: HTMLVideoElement; frame: number } | null>(null);
  // The last sync's arguments: run again once a handoff ends, to load what it held back.
  const lastSync = useRef<Parameters<VideoPool["sync"]> | null>(null);
  const lastTake = useRef<number | null>(null);
  // Elements mid-unlock: pausing one before its play() settles would undo it.
  const unlocking = useRef(new Set<HTMLVideoElement>());
  const handlers = useRef({ onEnded, onSoundBlocked, onBuffering });
  useEffect(() => {
    handlers.current = { onEnded, onSoundBlocked, onBuffering };
  });

  return useMemo<VideoPool>(() => {
    const live = () => els.current.filter((v): v is HTMLVideoElement => !!v);

    const play = (el: HTMLVideoElement) => {
      if (!el.paused) return;
      el.play().catch((err: unknown) => {
        const blocked = err instanceof DOMException && err.name === "NotAllowedError";
        if (!blocked || el.muted) return;
        el.muted = true;
        handlers.current.onSoundBlocked();
        el.play().catch(() => {});
      });
    };

    // iOS Safari doesn't buffer a video that has never played, whatever its
    // `preload`. A muted play-and-pause (allowed without a tap) makes it start.
    const prime = (v: HTMLVideoElement) => {
      v.muted = true;
      v.play().then(
        () => {
          if (v === shown.current || unlocking.current.has(v)) return;
          v.pause();
          v.currentTime = 0;
        },
        () => {},
      );
    };

    const stopHandoff = () => {
      if (handoff.current) cancelAnimationFrame(handoff.current.frame);
      handoff.current = null;
    };

    // The new clip's going (its time moving, or — paused — a frame to show), or
    // it's taken too long: show it, and put the old one away rewound.
    const watchHandoff = (from: HTMLVideoElement, to: HTMLVideoElement) => {
      stopHandoff();
      const t0 = to.currentTime;
      // Timed by the frames' own clock, from the first.
      let since: number | null = null;
      const check = (now: number) => {
        since ??= now;
        const h = handoff.current;
        if (!h || h.to !== to) return;
        const going = to.paused
          ? to.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          : to.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && to.currentTime !== t0;
        if (!going && now - since < HANDOFF_MAX_MS) {
          h.frame = requestAnimationFrame(check);
          return;
        }
        handoff.current = null;
        to.style.opacity = "1";
        if (from !== shown.current) {
          from.style.opacity = "0";
          if (from.currentTime > 0) from.currentTime = 0;
        }
        if (lastSync.current) pool.sync(...lastSync.current);
      };
      handoff.current = { from, to, frame: requestAnimationFrame(check) };
    };

    const pool: VideoPool = {
      refs: Array.from({ length: POOL_SIZE }, (_, i) => (el: HTMLVideoElement | null) => {
        els.current[i] = el;
        if (!el) return;
        const onScreen = () => el === shown.current;
        el.onended = () => onScreen() && handlers.current.onEnded();
        // Loading: waiting for data mid-play, until frames flow again (or it fails).
        el.onwaiting = () => onScreen() && !el.paused && handlers.current.onBuffering(true);
        el.onplaying = () => onScreen() && handlers.current.onBuffering(false);
        el.onerror = () => onScreen() && handlers.current.onBuffering(false);
      }),

      sync(upcoming, clip, opts) {
        lastSync.current = [upcoming, clip, opts];
        const { playing, muted, take } = opts;
        const slots = live();
        const prev = shown.current;
        // What's on screen now — mid-handoff, the clip still up — and, cutting
        // to another clip, kept there until the new one's going (not reused meanwhile).
        const visible = handoff.current?.from ?? prev;
        const keep = clip && visible && visible.dataset.url !== clip.url ? visible : null;
        const wanted = new Set(upcoming.map((c) => c.url));
        if (clip) wanted.add(clip.url);
        const order = clip && !upcoming.some((c) => c.url === clip.url) ? [clip, ...upcoming] : upcoming;

        for (const c of order) {
          if (slots.some((v) => v.dataset.url === c.url)) continue;
          const free =
            slots.find((v) => !v.dataset.url) ??
            slots.find((v) => !wanted.has(v.dataset.url!) && v !== prev && v !== keep) ??
            slots.find((v) => !wanted.has(v.dataset.url!) && v !== keep);
          // None free while the old clip's held up: loaded when the handoff ends.
          if (!free) break;
          free.pause();
          free.dataset.url = c.url;
          free.poster = c.poster;
          free.src = c.url;
          prime(free);
        }

        const el = clip ? (slots.find((v) => v.dataset.url === clip.url) ?? null) : null;
        const restart = take !== lastTake.current;
        lastTake.current = take;
        // Still handing over to this same clip: carry on. Anything else ends it (a new one starts below).
        const handing = !!el && !!keep && handoff.current?.from === keep && handoff.current.to === el;
        if (!handing) stopHandoff();

        for (const v of slots) {
          if (v === el) continue;
          v.style.zIndex = "0";
          if (!v.paused && !unlocking.current.has(v)) v.pause();
          // The clip we're cutting from stays up, paused, beneath the new one.
          if (el && v === keep) continue;
          v.style.opacity = "0";
          // Leave the clip we're moving off rewound, ready for next time.
          if ((v === prev || v === visible) && v.currentTime > 0) v.currentTime = 0;
        }
        shown.current = el;
        if (!el || !clip) {
          handlers.current.onBuffering(false);
          return;
        }

        el.style.zIndex = "1";
        el.style.opacity = keep ? "0" : "1";
        el.loop = clip.loop;
        el.muted = muted || clip.silent;
        if (restart && el.currentTime > 0) el.currentTime = 0;
        if (playing) play(el);
        else if (!el.paused) el.pause();
        if (keep && !handing) watchHandoff(keep, el);
        // Not enough loaded to play yet: loading until its "playing" event.
        handlers.current.onBuffering(playing && el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
      },

      unlock() {
        for (const v of live()) {
          if (!v.getAttribute("src") || v === shown.current) continue;
          unlocking.current.add(v);
          v.muted = false;
          v.play().then(
            () => {
              unlocking.current.delete(v);
              if (v === shown.current) return;
              v.pause();
              v.muted = true;
              v.currentTime = 0;
            },
            () => unlocking.current.delete(v),
          );
        }
      },

      current: () => shown.current,
    };
    return pool;
  }, []);
}

/**
 * The pool's elements, stacked; the shown one is made visible by `sync`.
 * `isolate` keeps their z-index (the new clip over the one it's taking over
 * from) to themselves — without it the shown video drew over everything on
 * the stage after it: the dim, the overview, the controls.
 */
export function PoolVideos({ pool, className = "" }: { pool: VideoPool; className?: string }) {
  return (
    <div className={`absolute inset-0 isolate ${className}`} aria-hidden="true">
      {pool.refs.map((ref, i) => (
        <video
          key={i}
          ref={ref}
          playsInline
          preload="auto"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover opacity-0"
        />
      ))}
    </div>
  );
}
