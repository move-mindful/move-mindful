// Joining MP3s end to end, for the voice announcements' spliced lines
// (announcements-server.ts): ElevenLabs sends MPEG-1 Layer III, and files in
// the same format join cleanly frame by frame — no re-encoding — once the tags
// round them are off (ID3v2 before, ID3v1 after) and any Xing/Info header
// frame, which would tell a player the first part is the whole file.

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];
const SAMPLES_PER_FRAME = 1152;

export interface Mp3Audio {
  /** The audio frames alone. */
  frames: Buffer;
  /** How long they play (seconds). */
  seconds: number;
  /** Sample rate and channels ("44100/1"): only files that match join. */
  format: string;
}

export function mp3Audio(file: Buffer): Mp3Audio {
  let at = 0;
  if (file.subarray(0, 3).toString("latin1") === "ID3") {
    const size = ((file[6] & 0x7f) << 21) | ((file[7] & 0x7f) << 14) | ((file[8] & 0x7f) << 7) | (file[9] & 0x7f);
    at = 10 + size + (file[5] & 0x10 ? 10 : 0);
  }
  const parts: Buffer[] = [];
  let samples = 0;
  let rate = 0;
  let format = "";
  while (at + 4 <= file.length) {
    const [b0, b1, b2, b3] = [file[at], file[at + 1], file[at + 2], file[at + 3]];
    // MPEG-1 Layer III; anything else (ID3v1's "TAG", junk) ends the audio.
    if (b0 !== 0xff || (b1 & 0xfe) !== 0xfa) break;
    const bitrate = BITRATES[b2 >> 4];
    const r = RATES[(b2 >> 2) & 3];
    if (!bitrate || !r) break;
    const length = Math.floor((144000 * bitrate) / r) + ((b2 >> 1) & 1);
    if (at + length > file.length) break;
    const mono = b3 >> 6 === 3;
    const tagAt = at + 4 + (mono ? 17 : 32);
    const tag = file.subarray(tagAt, tagAt + 4).toString("latin1");
    if (!(parts.length === 0 && (tag === "Xing" || tag === "Info"))) {
      parts.push(file.subarray(at, at + length));
      samples += SAMPLES_PER_FRAME;
      rate = r;
      format ||= `${r}/${mono ? 1 : 2}`;
    }
    at += length;
  }
  return { frames: Buffer.concat(parts), seconds: rate ? samples / rate : 0, format };
}

/** These one after another, as one MP3 — or null if they're not all the same format. */
export function joinMp3(parts: Mp3Audio[]): Buffer | null {
  if (!parts.length || parts.some((p) => !p.frames.length || p.format !== parts[0].format)) return null;
  return Buffer.concat(parts.map((p) => p.frames));
}
