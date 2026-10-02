/**
 * Finding the speech in a recorded audio tip, so the dead air before and
 * after it can be skipped (AudioTip `start` / `end`): from a moment before the
 * first word to a moment after the last — and how loud the voice is moment
 * to moment (voiceLevels), for the player's equalizer bars. Pure — the
 * builder decodes the recording and passes its samples in. See plan.md,
 * Phase 4.5.
 */

export interface SpeechTrimOptions {
  /** Room kept before the first word, in seconds (a breath, a soft first sound). */
  lead: number;
  /** Room kept after the last word (its tail as it fades). */
  tail: number;
  /** Loudness is measured in slices this long, in seconds. */
  slice: number;
  /** Speech has to stay up this many slices in a row, so a click on Record or Stop doesn't count. */
  sustain: number;
  /** Where the speech threshold sits between the room's noise (0) and the loudest speech (1). */
  threshold: number;
  /** Less contrast than this (dB) between the room and the loudest part: nothing to find. */
  minContrastDb: number;
}

export const DEFAULT_SPEECH_TRIM: SpeechTrimOptions = {
  lead: 0.15,
  tail: 0.3,
  slice: 0.02,
  sustain: 3,
  threshold: 0.3,
  minContrastDb: 10,
};

/**
 * Where the speech is in a recording, in seconds — or null when there's
 * nothing clearly louder than the room (keep it all). The threshold comes
 * from the recording itself: its quietest slices are the room's noise, its
 * loudest (a few outliers aside) the speech, so a quiet room and a noisy one
 * both trim cleanly. Pauses between words are never touched.
 */
export function speechBounds(
  channels: ArrayLike<number>[],
  sampleRate: number,
  options: Partial<SpeechTrimOptions> = {},
): { start: number; end: number } | null {
  const opts = { ...DEFAULT_SPEECH_TRIM, ...options };
  const length = channels[0]?.length ?? 0;
  const per = Math.max(1, Math.round(sampleRate * opts.slice));
  const slices = Math.floor(length / per);
  if (!channels.length || slices < opts.sustain) return null;

  // Each slice's loudness (RMS across the channels), in dB.
  const db: number[] = [];
  for (let s = 0; s < slices; s++) {
    let sum = 0;
    for (const ch of channels) {
      for (let i = s * per; i < (s + 1) * per; i++) sum += ch[i] * ch[i];
    }
    const rms = Math.sqrt(sum / (per * channels.length));
    db.push(20 * Math.log10(Math.max(rms, 1e-6)));
  }

  const sorted = [...db].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const noise = at(0.1);
  const loud = at(0.98);
  if (loud - noise < opts.minContrastDb) return null;
  const line = noise + (loud - noise) * opts.threshold;

  const up = (i: number) => db[i] >= line;
  const held = (from: number) => {
    for (let k = 0; k < opts.sustain; k++) if (!up(from + k)) return false;
    return true;
  };
  let first = -1;
  for (let i = 0; i + opts.sustain <= slices; i++) {
    if (held(i)) {
      first = i;
      break;
    }
  }
  let last = -1;
  for (let i = slices - opts.sustain; i >= 0; i--) {
    if (held(i)) {
      last = i + opts.sustain - 1;
      break;
    }
  }
  if (first < 0 || last < first) return null;

  const duration = length / sampleRate;
  const round = (t: number) => Math.round(t * 100) / 100;
  const start = round(Math.max(0, (first * per) / sampleRate - opts.lead));
  const end = round(Math.min(duration, ((last + 1) * per) / sampleRate + opts.tail));
  return end - start >= 0.3 ? { start, end } : null;
}

// ── Voice levels ──────────────────────────────────────
// How loud a tip's voice is from moment to moment, so the equalizer bars round
// the instructor's photo can follow it in the player. Worked out once in the
// builder, as the recording is trimmed, and saved with the tip (AudioTip
// `levels`) as one character per reading.

/** Readings per second of a recording's voice levels. */
export const VOICE_LEVELS_PER_SECOND = 30;

/** The characters a level is saved as, quietest to loudest. */
const LEVEL_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export interface VoiceLevelOptions {
  /** How fast a level falls back after a loud moment: 1 → 0 in this many seconds (rising is instant). */
  release: number;
  /** Below the room's noise plus this many dB reads as silence. */
  floorDb: number;
  /** Full scale is never less than this many dB above silence, so a flat recording (the room alone) stays low. */
  minRangeDb: number;
  /** Above 1, softer sounds sit lower and strong syllables stand out (the reading is raised to this power). */
  curve: number;
}

export const DEFAULT_VOICE_LEVELS: VoiceLevelOptions = {
  release: 0.15,
  floorDb: 3,
  minRangeDb: 12,
  curve: 1.6,
};

/**
 * The voice's loudness through a whole recording, 0 (the room) to 1 (its
 * loudest words), VOICE_LEVELS_PER_SECOND readings a second from the start of
 * the file. Measured against the recording itself, like speechBounds, so a
 * quiet take and a loud one move the bars alike. A reading rises at once and
 * falls back gently, as a meter does, so the bars jump on a word and settle
 * between them.
 */
export function voiceLevels(
  channels: ArrayLike<number>[],
  sampleRate: number,
  options: Partial<VoiceLevelOptions> = {},
): number[] {
  const opts = { ...DEFAULT_VOICE_LEVELS, ...options };
  const length = channels[0]?.length ?? 0;
  const count = Math.floor((length / sampleRate) * VOICE_LEVELS_PER_SECOND);
  if (!channels.length || count < 1) return [];

  const db: number[] = [];
  for (let n = 0; n < count; n++) {
    const from = Math.round((n * sampleRate) / VOICE_LEVELS_PER_SECOND);
    const to = Math.max(from + 1, Math.round(((n + 1) * sampleRate) / VOICE_LEVELS_PER_SECOND));
    let sum = 0;
    for (const ch of channels) {
      for (let i = from; i < to; i++) sum += ch[i] * ch[i];
    }
    const rms = Math.sqrt(sum / ((to - from) * channels.length));
    db.push(20 * Math.log10(Math.max(rms, 1e-6)));
  }

  const sorted = [...db].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const floor = at(0.1) + opts.floorDb;
  const top = Math.max(at(0.98), floor + opts.minRangeDb);
  const fall = 1 / (opts.release * VOICE_LEVELS_PER_SECOND);

  const out: number[] = [];
  let level = 0;
  for (const d of db) {
    const raw = Math.min(1, Math.max(0, (d - floor) / (top - floor))) ** opts.curve;
    level = Math.max(raw, level - fall);
    out.push(level);
  }
  return out;
}

/** Voice levels as saved with a tip: one character (0–9, a–z) per reading. */
export function encodeVoiceLevels(levels: number[]): string {
  const top = LEVEL_DIGITS.length - 1;
  return levels.map((l) => LEVEL_DIGITS[Math.round(Math.min(1, Math.max(0, l)) * top)]).join("");
}

/** A tip's saved voice levels back as 0–1 readings (anything unrecognised reads as silence). */
export function decodeVoiceLevels(text: string): number[] {
  const top = LEVEL_DIGITS.length - 1;
  return Array.from(text, (c) => Math.max(0, LEVEL_DIGITS.indexOf(c)) / top);
}

/** The voice's level `seconds` into the file, eased between readings; 0 outside the recording. */
export function voiceLevelAt(levels: number[], seconds: number): number {
  const x = seconds * VOICE_LEVELS_PER_SECOND - 0.5; // each reading sits mid-way through its slice
  if (!levels.length || !(x > -1) || x >= levels.length) return 0;
  const i = Math.floor(x);
  const a = levels[Math.max(0, i)];
  const b = levels[Math.min(levels.length - 1, i + 1)];
  return a + (b - a) * (x - i);
}
