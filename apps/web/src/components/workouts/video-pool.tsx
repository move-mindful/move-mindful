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
}: {
  /** The clip on screen reached its end (only clips that don't loop do). */
  onEnded: () => void;
  /** A clip couldn't start with sound, so it was started muted instead. */
  onSoundBlocked: () => void;
}): VideoPool {
  const els = useRef<Array<HTMLVideoElement | null>>([]);
  const shown = useRef<HTMLVideoElement | null>(null);
  const lastTake = useRef<number | null>(null);
  // Elements mid-unlock: pausing one before its play() settles would undo it.
  const unlocking = useRef(new Set<HTMLVideoElement>());
  const handlers = useRef({ onEnded, onSoundBlocked });
  useEffect(() => {
    handlers.current = { onEnded, onSoundBlocked };
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

    return {
      refs: Array.from({ length: POOL_SIZE }, (_, i) => (el: HTMLVideoElement | null) => {
        els.current[i] = el;
        if (el) el.onended = () => el === shown.current && handlers.current.onEnded();
      }),

      sync(upcoming, clip, { playing, muted, take }) {
        const slots = live();
        const wanted = new Set(upcoming.map((c) => c.url));
        if (clip) wanted.add(clip.url);
        const order = clip && !upcoming.some((c) => c.url === clip.url) ? [clip, ...upcoming] : upcoming;

        for (const c of order) {
          if (slots.some((v) => v.dataset.url === c.url)) continue;
          const free =
            slots.find((v) => !v.dataset.url) ??
            slots.find((v) => !wanted.has(v.dataset.url!) && v !== shown.current) ??
            slots.find((v) => !wanted.has(v.dataset.url!));
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

        for (const v of slots) {
          if (v === el) continue;
          v.style.opacity = "0";
          if (!v.paused && !unlocking.current.has(v)) v.pause();
          // Leave the clip we're moving off rewound, ready for next time.
          if (v === shown.current && v.currentTime > 0) v.currentTime = 0;
        }
        shown.current = el;
        if (!el || !clip) return;

        el.style.opacity = "1";
        el.loop = clip.loop;
        el.muted = muted || clip.silent;
        if (restart && el.currentTime > 0) el.currentTime = 0;
        if (playing) play(el);
        else if (!el.paused) el.pause();
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
  }, []);
}

/** The pool's elements, stacked; the shown one is made visible by `sync`. */
export function PoolVideos({ pool, className = "" }: { pool: VideoPool; className?: string }) {
  return (
    <div className={`absolute inset-0 ${className}`} aria-hidden="true">
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
