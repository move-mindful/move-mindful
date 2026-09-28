"use client";

import { useState, useSyncExternalStore } from "react";
import { savePlayerPreferences } from "@/app/actions/preferences";
import { DEFAULT_PLAYER_PREFERENCES, type PlayerPreferences } from "@/lib/member/preferences";

// The member's workout player settings — tutorial mode and instructor audio
// (Settings), and whether to begin with the warm-up (the preview's switch).
//
// Signed in, they're kept on the account (member_preferences, loaded with the
// page and saved by a server action), so they follow the member everywhere.
// Every change is also kept in this browser's localStorage, which is all a
// signed-out visitor (/demo1) has, and what fills in anything the account
// hasn't saved yet. Each save sends the whole set, so the first change made on
// a device copies its settings to the account.

const KEYS = {
  tutorialMode: "movemindful.tutorialMode",
  instructorAudio: "movemindful.sound",
  warmup: "movemindful.warmup",
} as const;

// A change made on this page, kept even when storage is blocked (some private
// modes), until a reload.
const memory: Partial<PlayerPreferences> = {};
const listeners = new Set<() => void>();

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readDevice(): Partial<PlayerPreferences> {
  const out: Partial<PlayerPreferences> = {};
  const mode = readItem(KEYS.tutorialMode);
  if (mode === "loop" || mode === "once" || mode === "off") out.tutorialMode = mode;
  const audio = readItem(KEYS.instructorAudio);
  if (audio === "on" || audio === "off") out.instructorAudio = audio === "on";
  const warmup = readItem(KEYS.warmup);
  if (warmup === "on" || warmup === "off") out.warmup = warmup === "on";
  return { ...out, ...memory };
}

function writeDevice(changes: Partial<PlayerPreferences>) {
  Object.assign(memory, changes);
  try {
    if (changes.tutorialMode) window.localStorage.setItem(KEYS.tutorialMode, changes.tutorialMode);
    if (changes.instructorAudio !== undefined) {
      window.localStorage.setItem(KEYS.instructorAudio, changes.instructorAudio ? "on" : "off");
    }
    if (changes.warmup !== undefined) window.localStorage.setItem(KEYS.warmup, changes.warmup ? "on" : "off");
  } catch {
    // Blocked: `memory` keeps it for now.
  }
  listeners.forEach((l) => l());
}

// useSyncExternalStore wants the same object back while nothing has changed.
let cached: { key: string; value: Partial<PlayerPreferences> } | null = null;
function deviceSnapshot(): Partial<PlayerPreferences> {
  const value = readDevice();
  const key = JSON.stringify(value);
  if (cached?.key !== key) cached = { key, value };
  return cached.value;
}

const NOTHING: Partial<PlayerPreferences> = {};

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The member's player settings — the account's, then this device's, then the
 * defaults — and a function to change some of them. `account` is what the
 * page loaded for a signed-in member (null signed out).
 *
 * The device's values are read after hydration (the server can't see them),
 * so the first paint uses the account's and the defaults.
 */
export function usePlayerPreferences({
  account,
  signedIn,
}: {
  account: Partial<PlayerPreferences> | null;
  signedIn: boolean;
}): [PlayerPreferences, (changes: Partial<PlayerPreferences>) => void] {
  const device = useSyncExternalStore(subscribe, deviceSnapshot, () => NOTHING);
  const [saved, setSaved] = useState<Partial<PlayerPreferences>>(account ?? {});
  const prefs: PlayerPreferences = { ...DEFAULT_PLAYER_PREFERENCES, ...device, ...saved };

  function update(changes: Partial<PlayerPreferences>) {
    writeDevice(changes);
    if (!signedIn) return;
    setSaved((prev) => ({ ...prev, ...changes }));
    savePlayerPreferences({ ...prefs, ...changes }).catch(() => {
      // Offline or the save failed: the device keeps it, and the next change
      // sends everything again.
    });
  }

  return [prefs, update];
}
