/**
 * Finding the speech in a recorded audio tip, so the dead air before and
 * after it can be skipped (AudioTip `start` / `end`): from a moment before the
 * first word to a moment after the last. Pure — the builder decodes the
 * recording and passes its samples in. See plan.md, Phase 4.5.
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
