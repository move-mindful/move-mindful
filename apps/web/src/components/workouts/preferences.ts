"use client";

import { useSyncExternalStore } from "react";
import type { TutorialMode } from "@move-mindful/core";

// The member's workout player preferences: tutorial mode and instructor audio
// (Settings), and whether to begin with the warm-up (the preview's switch).
//
// Kept in this browser's localStorage, not on the account: they survive signing
// out and in, but don't follow the member to another device or browser (an
// iPhone home-screen app has its own storage, apart from Safari), and go if
// site data is cleared. If storage is blocked (some private modes) they last
// until the page is reloaded.

const KEYS = {
  tutorialMode: "movemindful.tutorialMode",
  sound: "movemindful.sound",
  warmup: "movemindful.warmup",
} as const;

type Key = keyof typeof KEYS;

// Fallback when storage is blocked, so a change still takes effect.
const memory = new Map<Key, string>();
// Told about every change, for useWarmupOn below.
const listeners = new Set<() => void>();

function read(key: Key): string | null {
  // A change made on this page wins, even if storage couldn't keep it.
  const changed = memory.get(key);
  if (changed !== undefined) return changed;
  try {
    return window.localStorage.getItem(KEYS[key]);
  } catch {
    return null;
  }
}

function write(key: Key, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(KEYS[key], value);
  } catch {
    // Blocked: memory keeps it for now.
  }
  listeners.forEach((l) => l());
}

export function storedTutorialMode(): TutorialMode {
  const v = read("tutorialMode");
  return v === "once" || v === "off" ? v : "loop";
}

export function storeTutorialMode(mode: TutorialMode) {
  write("tutorialMode", mode);
}

/** Tutorials and the warm-up with sound (exercise loops are always silent). */
export function storedSoundOn(): boolean {
  return read("sound") !== "off";
}

export function storeSoundOn(on: boolean) {
  write("sound", on ? "on" : "off");
}

export function storeWarmupOn(on: boolean) {
  write("warmup", on ? "on" : "off");
}

// ── For rendering ─────────────────────────────────────
// The preview shows the warm-up switch on first paint, which is rendered on the
// server with no storage, so it reads through useSyncExternalStore: "on" on the
// server and during hydration, then the stored value.

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Begin with the warm-up? On unless the member switched it off last time. */
export function useWarmupOn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read("warmup") !== "off",
    () => true,
  );
}
