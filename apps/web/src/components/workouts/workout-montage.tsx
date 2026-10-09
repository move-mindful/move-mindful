"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PlayerClip } from "@/lib/workouts/player";
import { Pause, Play } from "./icons";

const EXERCISE_MS = 3_000;
const FADE_MS = 450;

/** The cover paints first; reduced motion and unavailable autoplay keep it. */
export function WorkoutMontage({ clips, cover }: { clips: PlayerClip[]; cover: string | null }) {
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <div className="absolute inset-0">
      {cover && (
        <Image
          src={cover}
          alt=""
          fill
          unoptimized
          preload
          className="object-cover"
          style={{ objectPosition: "50% 28%" }}
        />
      )}
      {motionOk && clips.length > 0 && <MontageVideos clips={clips} />}
    </div>
  );
}

/** Two reusable elements: the exercise on screen and the one coming next. */
function MontageVideos({ clips }: { clips: PlayerClip[] }) {
  const container = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);
  const setPlaybackPaused = useRef<((paused: boolean) => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed || !container.current || !first.current || !second.current) return;
    const videos = [first.current, second.current];
    const loaded: Array<number | null> = [null, null];
    let disposed = false;
    let visible = false;
    let userPaused = false;
    let active: number | null = null;
    let pending: number | null = null;
    let elapsed = 0;
    let lastFrame = 0;
    let frame = 0;
    let prepareTimer = 0;
    let attempt = 0;

    const canPlay = () => !disposed && visible && !document.hidden && !userPaused;
    const load = (slot: number, index: number) => {
      if (loaded[slot] === index) return;
      const video = videos[slot];
      video.pause();
      video.style.opacity = "0";
      video.muted = true;
      loaded[slot] = index;
      video.src = clips[index].url;
      video.load();
    };

    const play = (slot: number, reveal: boolean) => {
      const video = videos[slot];
      const request = ++attempt;
      video.muted = true;
      void video.play().then(() => {
        if (disposed || request !== attempt || !canPlay()) return;
        if (!reveal) return;
        // Only fade once playback has started. A slow next clip leaves the
        // previous exercise visible, rather than exposing a black frame.
        const previous = active;
        active = slot;
        pending = null;
        elapsed = 0;
        lastFrame = performance.now();
        video.style.zIndex = "1";
        video.style.opacity = "1";
        setStarted(true);
        if (previous !== null && previous !== slot) {
          videos[previous].style.zIndex = "0";
          videos[previous].pause();
        }
        // Let the outgoing frame finish fading before replacing its source.
        window.clearTimeout(prepareTimer);
        if (clips.length > 1) {
          prepareTimer = window.setTimeout(() => {
            if (disposed) return;
            videos[1 - slot].style.opacity = "0";
            load(1 - slot, (loaded[slot]! + 1) % clips.length);
          }, FADE_MS);
        }
      }).catch((error: unknown) => {
        if (disposed || request !== attempt || !canPlay()) return;
        // pause()/load() can interrupt a pending play during a visibility change.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    };

    const tick = (now: number) => {
      if (!canPlay()) return;
      if (active !== null && pending === null) {
        const video = videos[active];
        // Count visible playback, excluding buffering and pauses. Short clips
        // loop to fill their three seconds; a one-exercise workout simply loops.
        if (!video.paused && !video.seeking && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
          elapsed += Math.min(now - lastFrame, 250);
        }
        if (elapsed >= EXERCISE_MS && clips.length > 1) {
          pending = 1 - active;
          load(pending, (loaded[active]! + 1) % clips.length);
          videos[pending].currentTime = 0;
          play(pending, true);
        }
      }
      lastFrame = now;
      frame = window.requestAnimationFrame(tick);
    };

    const sync = () => {
      ++attempt;
      window.cancelAnimationFrame(frame);
      if (!canPlay()) {
        videos.forEach((video) => video.pause());
        return;
      }
      if (active === null && pending === null) {
        load(0, 0);
        pending = 0;
      }
      // A pending handoff resumes directly; the outgoing frame stays visible.
      if (pending !== null) play(pending, true);
      else if (active !== null) play(active, false);
      lastFrame = performance.now();
      frame = window.requestAnimationFrame(tick);
    };

    setPlaybackPaused.current = (value) => {
      userPaused = value;
      sync();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(container.current);
    document.addEventListener("visibilitychange", sync);

    return () => {
      disposed = true;
      ++attempt;
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(prepareTimer);
      setPlaybackPaused.current = null;
      // Begin/Resume unmounts the preview. Release its downloads and decoders
      // so they cannot compete with the actual workout's video pool.
      videos.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [clips, failed]);

  useEffect(() => {
    setPlaybackPaused.current?.(paused);
  }, [paused, clips]);

  if (failed) return null;

  const videoProps = {
    muted: true,
    playsInline: true,
    loop: true,
    preload: "auto",
    disablePictureInPicture: true,
    "aria-hidden": true as const,
    tabIndex: -1,
    onError: () => setFailed(true),
    className: "pointer-events-none absolute inset-0 size-full object-cover opacity-0 transition-opacity",
    style: { objectPosition: "50% 28%", transitionDuration: `${FADE_MS}ms` },
  };

  return (
    <div ref={container} className="absolute inset-0">
      {/* Keep the crossfade's stacking inside the media, below the overview's
          gradients and text; the pause control can sit above those overlays. */}
      <div className="absolute inset-0 isolate">
        <video ref={first} {...videoProps} />
        <video ref={second} {...videoProps} />
      </div>
      {started && (
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? "Play exercise preview" : "Pause exercise preview"}
          className="absolute right-4 top-5 z-20 flex size-11 items-center justify-center rounded-full bg-[#0C1014]/50 text-white backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white theater:right-12 theater:top-8"
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      )}
    </div>
  );
}
