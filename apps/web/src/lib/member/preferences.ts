// A member's settings, as stored on their account (member_preferences,
// supabase/migrations/012_member_preferences.sql). Shared by the server, which
// reads and writes them, and the player, which uses them. No server-only
// imports.

import type { TutorialMode } from "@move-mindful/core";

/** The workout player's settings. */
export interface PlayerPreferences {
  /** What plays before each new exercise. */
  tutorialMode: TutorialMode;
  /**
   * The player's sound at all — off is the Audio card's "Mute all". On, the
   * tutorials, intro, warm-up, cool-down and outro play with sound (exercise
   * loops are always silent), and so do audio tips unless `audioTips` is off.
   * (Named for what it first switched; kept so saved settings carry over.)
   */
  instructorAudio: boolean;
  /** The instructor's audio tips during sets and rests. */
  audioTips: boolean;
  /** Music during the workout — a placeholder in the Audio card; nothing plays yet. */
  music: boolean;
  /** Sound effects — a placeholder in the Audio card; there are none yet. */
  soundEffects: boolean;
  /**
   * Play instructor audio over music from other apps instead of pausing it.
   * Only where the browser can (navigator.audioSession: Safari, Firefox).
   */
  mixAudio: boolean;
  /** Begin workouts with their warm-up. */
  warmup: boolean;
  /** Rep sets move on by themselves after their estimated time. */
  autoAdvance: boolean;
  /** Has seen the first-run gesture guide on a phone (so it doesn't show again). */
  seenGestureGuide: boolean;
  /**
   * Has seen the desktop guide — kept apart from the phone one because the
   * controls differ (buttons and keys rather than taps and swipes).
   */
  seenDesktopGuide: boolean;
}

// Hands-free by default: tutorials play once and rep sets move on by
// themselves; a member can switch to Loop or tap-to-advance in Settings.
export const DEFAULT_PLAYER_PREFERENCES: PlayerPreferences = {
  tutorialMode: "once",
  instructorAudio: true,
  audioTips: true,
  music: true,
  soundEffects: true,
  mixAudio: false,
  warmup: true,
  autoAdvance: true,
  seenGestureGuide: false,
  seenDesktopGuide: false,
};

/** Keep only well-formed player settings from untrusted JSON. */
export function cleanPlayerPreferences(raw: unknown): Partial<PlayerPreferences> {
  const out: Partial<PlayerPreferences> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (r.tutorialMode === "loop" || r.tutorialMode === "once" || r.tutorialMode === "off") out.tutorialMode = r.tutorialMode;
  if (typeof r.instructorAudio === "boolean") out.instructorAudio = r.instructorAudio;
  if (typeof r.audioTips === "boolean") out.audioTips = r.audioTips;
  if (typeof r.music === "boolean") out.music = r.music;
  if (typeof r.soundEffects === "boolean") out.soundEffects = r.soundEffects;
  if (typeof r.mixAudio === "boolean") out.mixAudio = r.mixAudio;
  if (typeof r.warmup === "boolean") out.warmup = r.warmup;
  if (typeof r.autoAdvance === "boolean") out.autoAdvance = r.autoAdvance;
  if (typeof r.seenGestureGuide === "boolean") out.seenGestureGuide = r.seenGestureGuide;
  if (typeof r.seenDesktopGuide === "boolean") out.seenDesktopGuide = r.seenDesktopGuide;
  return out;
}
