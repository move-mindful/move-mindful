// Trimming the dead air off a recorded audio tip, in the browser: decode it
// and find the speech (speechBounds in core). The tip keeps the whole file
// and plays just that part (AudioTip `start` / `end`).

import { speechBounds, type AudioTip } from "@move-mindful/core";

type OfflineContextWindow = Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext };

/**
 * Where the speech is in a recording, and how long the file is — the whole of
 * it when there's no dead air to trim. Null when the browser can't decode it.
 */
export async function findSpeech(data: ArrayBuffer): Promise<{ start: number; end: number; duration: number } | null> {
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
  return { ...(speechBounds(channels, buffer.sampleRate) ?? { start: 0, end: duration }), duration };
}

/** The tip, playing only its speech. */
export function trimmed(tip: AudioTip, speech: { start: number; end: number }): AudioTip {
  return { ...tip, start: speech.start, end: speech.end, seconds: Math.round((speech.end - speech.start) * 10) / 10 };
}
