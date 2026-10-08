import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { VOICE, type VoiceLine } from "@/lib/workouts/announcements";
import { joinMp3, mp3Audio } from "@/lib/workouts/mp3";
import { NEXT_UP_CLIP } from "@/lib/workouts/next-up-clip";

// The voice announcements' recordings (see announcements.ts): made with
// ElevenLabs text to speech, stored in the public `voice-lines` bucket and
// listed in `voice_lines` (024_voice_announcements.sql). A line is made once,
// for every workout that says it. ELEVENLABS_API_KEY is server-only; a
// restricted key needs Text to Speech.

const BUCKET = "voice-lines";
const TTS = "https://api.elevenlabs.io/v1/text-to-speech";
/** ElevenLabs takes this many requests at once on the account's plan. */
const AT_ONCE = 3;
/** At most this many new lines per save — a guard on what one save can spend. */
const MOST_PER_SAVE = 150;
/**
 * No new line is started this long (ms) into a run: the builder's requests
 * get 60 s (maxDuration on its pages), and a line takes about a second. What's
 * left is made on the next save.
 */
const TIME_BUDGET = 40_000;

/**
 * A rest's line naming what's next — "Starting rest, 30 seconds. Next up,
 * bicep curl, 10 reps." — is made in two parts round the owner's own "Next
 * up" (NEXT_UP_CLIP): made whole, ElevenLabs said it too animatedly.
 */
const REST_WITH_NEXT = /^(Starting rest, [^.]+\.) Next up, (.+)$/;
const NEXT_UP = mp3Audio(NEXT_UP_CLIP.mp3);

/**
 * The line's name: its file's, and its row's key. The voice and model are in
 * it, and for a spliced line the Next up clip's version, so a new one makes new files.
 */
function lineKey(text: string): string {
  const recipe = REST_WITH_NEXT.test(text) ? `\n${NEXT_UP_CLIP.version}` : "";
  return createHash("sha256").update(`${VOICE.voiceId}\n${VOICE.modelId}\n${text}${recipe}`).digest("hex").slice(0, 40);
}

function lineUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}.mp3`;
}

type Found = { lines: Record<string, VoiceLine>; missingTable: boolean };

async function findLines(texts: string[]): Promise<Found> {
  if (!texts.length) return { lines: {}, missingTable: false };
  const { data, error } = await createAdminClient()
    .from("voice_lines")
    .select("key, text, seconds")
    .in("key", texts.map(lineKey));
  // PGRST205: no table yet (024 not run).
  if (error) return { lines: {}, missingTable: error.code === "PGRST205" };
  const lines = Object.fromEntries((data ?? []).map((r) => [r.text as string, { url: lineUrl(r.key), seconds: r.seconds }]));
  return { lines, missingTable: false };
}

/** The lines already made, by their words. None before 024 has run, or when ElevenLabs hasn't made them yet. */
export async function getVoiceLines(texts: string[]): Promise<Record<string, VoiceLine>> {
  return (await findLines(texts)).lines;
}

class VoiceError extends Error {}

/** One line from ElevenLabs: the MP3, where its speech ends, and the characters charged. */
async function speak(text: string, apiKey: string): Promise<{ audio: Buffer; seconds: number; characters: number }> {
  const res = await fetch(`${TTS}/${VOICE.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: VOICE.modelId }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: { message?: string } | string } | null;
    const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
    throw new VoiceError(`ElevenLabs said no (${res.status})${detail ? `: ${detail}` : "."}`);
  }
  const data = (await res.json()) as {
    audio_base64?: string;
    alignment?: { character_end_times_seconds?: number[] } | null;
  };
  const audio = Buffer.from(data.audio_base64 ?? "", "base64");
  // Where the speech ends — just short of the file's end, which has a moment of quiet after it.
  const seconds = data.alignment?.character_end_times_seconds?.at(-1) ?? 0;
  if (!audio.length || !(seconds > 0)) throw new VoiceError("ElevenLabs sent back no audio.");
  return { audio, seconds, characters: Number(res.headers.get("character-cost")) || text.length };
}

/**
 * A line's recording, made but not stored: as ElevenLabs says it — or a rest's
 * naming what's next, its two parts said one after the other (the plan takes
 * three requests at once, which the workers use) and joined round the Next up
 * clip. `seconds` is where the speech ends, the last part's end counted from
 * the joined file's start.
 */
export async function voiceLineAudio(
  text: string,
  apiKey: string,
): Promise<{ audio: Buffer; seconds: number; characters: number }> {
  const parts = text.match(REST_WITH_NEXT);
  if (!parts) return speak(text, apiKey);
  const rest = await speak(parts[1], apiKey);
  const next = await speak(parts[2], apiKey);
  const before = mp3Audio(rest.audio);
  const joined = joinMp3([before, NEXT_UP, mp3Audio(next.audio)]);
  if (!joined) {
    // ElevenLabs' format no longer matches the clip's: say it all instead.
    console.warn("[voice-lines] the Next up clip doesn't match; making the line whole");
    return speak(text, apiKey);
  }
  return {
    audio: joined,
    seconds: before.seconds + NEXT_UP.seconds + next.seconds,
    characters: rest.characters + next.characters,
  };
}

/**
 * Make whichever of these lines haven't been made yet. Returns how many there
 * are, how many are ready now, how many it made, and the first thing that went
 * wrong, if anything did (the lines it did make are kept).
 */
export async function makeVoiceLines(
  texts: string[],
): Promise<{ total: number; ready: number; made: number; error?: string }> {
  const total = texts.length;
  const found = await findLines(texts);
  const already = Object.keys(found.lines).length;
  if (found.missingTable) {
    return { total, ready: 0, made: 0, error: "Voice announcements can’t be made until migration 024_voice_announcements.sql has run." };
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (already < total && !apiKey) {
    return { total, ready: already, made: 0, error: "Voice announcements need ELEVENLABS_API_KEY set on the server." };
  }
  const todo = texts.filter((t) => !found.lines[t]).slice(0, MOST_PER_SAVE);
  const supabase = createAdminClient();
  let made = 0;
  let error: string | undefined;

  async function makeOne(text: string) {
    const key = lineKey(text);
    const { audio, seconds, characters } = await voiceLineAudio(text, apiKey!);
    console.info(`[voice-lines] made "${text}": ${characters} characters, ${seconds.toFixed(2)} s`);
    const upload = await supabase.storage
      .from(BUCKET)
      // Named by its words and voice, so it never changes: cached for good.
      .upload(`${key}.mp3`, audio, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: true });
    if (upload.error) throw new VoiceError(`Saving a voice line failed: ${upload.error.message}`);
    const row = await supabase.from("voice_lines").upsert({
      key,
      text,
      voice_id: VOICE.voiceId,
      model_id: VOICE.modelId,
      seconds: Math.round(seconds * 1000) / 1000,
      characters,
    });
    if (row.error) throw new VoiceError(`Saving a voice line failed: ${row.error.message}`);
    made++;
  }

  // A few at a time — as many as the plan takes at once — until one fails or time's up.
  const queue = [...todo];
  const stopAt = Date.now() + TIME_BUDGET;
  async function worker() {
    for (let text = queue.shift(); text !== undefined && !error && Date.now() < stopAt; text = queue.shift()) {
      try {
        await makeOne(text);
      } catch (err) {
        console.error("[voice-lines]", err);
        error ??= err instanceof VoiceError ? err.message : "Couldn’t reach ElevenLabs to make the voice announcements.";
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, todo.length) }, worker));
  const ready = already + made;
  if (!error && ready < total) error = "There wasn’t time to make every voice announcement — save again to make the rest.";
  return { total, ready, made, error };
}
