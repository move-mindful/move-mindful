"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const loadScene = () => import("./first-workout-badge-scene");

/**
 * Start fetching the badge's 3D code (Three.js) ahead of time, so it's ready
 * the moment a workout finishes. Safe to call more than once.
 */
export function preloadFirstWorkoutBadge() {
  loadScene().catch(() => {
    // Offline: the badge tries again when it's shown, and falls back if it can't.
  });
}

/**
 * The 1st Workout badge, slowly turning in 3D (first-workout-badge-scene.ts).
 * Hidden until it's drawing, then it spins in; shows `fallback` instead if 3D
 * can't run here or its code can't be fetched.
 */
export function FirstWorkoutBadge({ fallback, className = "" }: { fallback: ReactNode; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    loadScene()
      .then(({ mountBadge }) => {
        if (cancelled || !canvas.current) return;
        stop = mountBadge(canvas.current, { reduceMotion });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (status === "failed") return fallback;
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label="1st Workout badge"
      className={`touch-pan-y transition-opacity duration-200 ${status === "ready" ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
