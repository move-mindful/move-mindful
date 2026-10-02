// Reading a recorded audio tip, in the browser: decode it, find the speech
// (speechBounds in core) so the dead air either side can be skipped, and
// measure the voice's loudness through it (voiceLevels) for the player's
// equalizer bars. The tip keeps the whole file and plays just the speech
// (AudioTip `start` / `end`); its `levels` cover the whole file.

import { encodeVoiceLevels, speechBounds, voiceLevels, type AudioTip } from "@move-mindful/core";

type OfflineContextWindow = Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext };

/** What a recording holds: where its speech is, how long the file is, and its voice levels. */
export type TipReading = { start: number; end: number; duration: number; levels: string };

/**
 * Where the speech is in a recording (the whole of it when there's no dead
 * air to trim), how long the file is, and how loud the voice is through it.
 * Null when the browser can't decode it.
 */
export async function readRecording(data: ArrayBuffer): Promise<TipReading | null> {
  const Context = window.OfflineAudioContext ?? (window as OfflineContextWindow).webkitOfflineAudioContext;
  if (!Context) return null;
  let buffer: AudioBuffer;
  try {
    buffer = await new Context(1, 1, 44100).decodeAudioData(data);
  } catch {
    return null;
  }
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const duration = Math.round(buffer.duration * 100) / 100;
  return {
    ...(speechBounds(channels, buffer.sampleRate) ?? { start: 0, end: duration }),
    duration,
    levels: encodeVoiceLevels(voiceLevels(channels, buffer.sampleRate)),
  };
}

/**
 * The tip with what its recording holds: playing only its speech, with its
 * voice levels. One trimmed before levels existed keeps its trim.
 */
export function withReading(tip: AudioTip, reading: TipReading): AudioTip {
  const levels = reading.levels ? { levels: reading.levels } : {};
  if (tip.end !== undefined) return { ...tip, ...levels };
  return {
    ...tip,
    start: reading.start,
    end: reading.end,
    seconds: Math.round((reading.end - reading.start) * 10) / 10,
    ...levels,
  };
}
