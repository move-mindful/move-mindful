// A member's settings, as stored on their account (member_preferences,
// supabase/migrations/012_member_preferences.sql). Shared by the server, which
// reads and writes them, and the player, which uses them. No server-only
// imports.

import type { TutorialMode } from "@move-mindful/core";

/** The workout player's settings. */
export interface PlayerPreferences {
  /** What plays before each new exercise. */
  tutorialMode: TutorialMode;
  /** Tutorials and the warm-up with sound (exercise loops are always silent). */
  instructorAudio: boolean;
  /**
   * Play instructor audio over music from other apps instead of pausing it.
   * Only where the browser can (navigator.audioSession: Safari, Firefox).
   */
  mixAudio: boolean;
  /** Begin workouts with their warm-up. */
  warmup: boolean;
  /** Has seen the first-run gesture guide (so it doesn't show again). */
  seenGestureGuide: boolean;
}

export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  tutorialMode: "loop",
  instructorAudio: true,
  mixAudio: false,
  warmup: true,
  seenGestureGuide: false,
};

/** Keep only well-formed player settings from untrusted JSON. */
export function cleanPlayerPreferences(raw: unknown): Partial<PlayerPreferences> {
  const out: Partial<PlayerPreferences> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (r.tutorialMode === "loop" || r.tutorialMode === "once" || r.tutorialMode === "off") out.tutorialMode = r.tutorialMode;
  if (typeof r.instructorAudio === "boolean") out.instructorAudio = r.instructorAudio;
  if (typeof r.mixAudio === "boolean") out.mixAudio = r.mixAudio;
  if (typeof r.warmup === "boolean") out.warmup = r.warmup;
  if (typeof r.seenGestureGuide === "boolean") out.seenGestureGuide = r.seenGestureGuide;
  return out;
}
