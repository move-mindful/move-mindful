const DEFAULT_LIVE_PLAYBACK_ID = "Duyn2ZibZylttGQjR5922VmtybBaRbKTJ3c46XHE8YE";
const configuredLivePlaybackId =
  process.env.NEXT_PUBLIC_MUX_LIVESTREAM_PLAYBACK_ID?.trim();

export const LIVE_PLAYBACK_ID =
  configuredLivePlaybackId || DEFAULT_LIVE_PLAYBACK_ID;
