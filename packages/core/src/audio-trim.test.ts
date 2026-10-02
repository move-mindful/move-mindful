import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeVoiceLevels,
  encodeVoiceLevels,
  speechBounds,
  voiceLevelAt,
  voiceLevels,
  VOICE_LEVELS_PER_SECOND,
} from "./audio-trim.ts";

const RATE = 8000;

// A steady hiss — the room — the same every run.
function hiss(seconds: number, level = 0.003, seed = 7): number[] {
  let x = seed;
  return Array.from({ length: Math.round(seconds * RATE) }, () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return (x / 2147483648 - 0.5) * 2 * level;
  });
}

// "Speech": a tone that swells and dips like syllables.
function talk(seconds: number, level = 0.3): number[] {
  return Array.from({ length: Math.round(seconds * RATE) }, (_, i) => {
    const t = i / RATE;
    return Math.sin(2 * Math.PI * 220 * t) * level * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
  });
}

// A click — the mouse on Record or Stop: loud, but over in 10 ms.
const click = () => Array.from({ length: Math.round(0.01 * RATE) }, (_, i) => (i % 2 ? 0.9 : -0.9));

const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) <= 0.03, `${actual} should be about ${expected}`);

test("trims the dead air around the speech, keeping a moment either side — clicks and pauses aside", () => {
  const samples = new Float32Array([
    ...hiss(0.2),
    ...click(),
    ...hiss(0.79), // speech starts at 1.0 s
    ...talk(1.2),
    ...hiss(0.4), // a pause mid-tip: kept
    ...talk(0.8), // speech ends at 3.4 s
    ...hiss(1.0),
    ...click(),
    ...hiss(0.3),
  ]);
  const bounds = speechBounds([samples], RATE);
  assert.ok(bounds);
  near(bounds.start, 1.0 - 0.15);
  near(bounds.end, 3.4 + 0.3);
});

test("nothing louder than the room: nothing to trim", () => {
  assert.equal(speechBounds([new Float32Array(hiss(3))], RATE), null);
  assert.equal(speechBounds([new Float32Array(Math.round(2 * RATE))], RATE), null, "digital silence");
});

test("speech right from the start to the very end keeps it all", () => {
  const samples = new Float32Array(talk(2));
  const bounds = speechBounds([samples, samples], RATE);
  assert.ok(bounds);
  near(bounds.start, 0);
  near(bounds.end, 2);
});

// ── Voice levels ──

const reading = (seconds: number) => Math.floor(seconds * VOICE_LEVELS_PER_SECOND);

test("voice levels: up while talking, down to nothing in the pauses and the room", () => {
  const samples = new Float32Array([...hiss(1), ...talk(1), ...hiss(1), ...talk(1, 0.1), ...hiss(1)]);
  const levels = voiceLevels([samples], RATE);
  assert.equal(levels.length, 5 * VOICE_LEVELS_PER_SECOND);
  const avg = (from: number, to: number) => {
    const part = levels.slice(reading(from), reading(to));
    return part.reduce((a, b) => a + b, 0) / part.length;
  };
  assert.ok(avg(0.1, 0.9) < 0.05, "the room before");
  assert.ok(avg(1.1, 1.9) > 0.6, "loud talking");
  assert.ok(avg(2.4, 2.9) < 0.05, "the pause (once the meter has fallen)");
  const quiet = avg(3.1, 3.9);
  assert.ok(quiet > 0.2 && quiet < avg(1.1, 1.9), `quieter talking sits lower (${quiet})`);
  assert.ok(avg(4.4, 4.9) < 0.05, "the room after");
  assert.ok(levels.every((l) => l >= 0 && l <= 1));
});

test("voice levels rise at once and fall back gently", () => {
  const samples = new Float32Array([...hiss(1), ...talk(1), ...hiss(1)]);
  const levels = voiceLevels([samples], RATE);
  assert.ok(levels[reading(1) + 1] > 0.5, "up within a reading or two of the first word");
  const after = levels.slice(reading(2), reading(2.5));
  for (let i = 1; i < after.length; i++) assert.ok(after[i] <= after[i - 1] + 1e-9, "falls, never jumps, in the silence");
  assert.ok(after[1] > 0.3, "still settling a moment after");
  assert.ok(after[after.length - 1] < 0.05, "settled well within half a second");
});

test("voice levels: nothing to measure gives nothing; a flat hiss stays low", () => {
  assert.deepEqual(voiceLevels([], RATE), []);
  assert.deepEqual(voiceLevels([new Float32Array(10)], RATE), []);
  const flat = voiceLevels([new Float32Array(hiss(2))], RATE);
  assert.ok(Math.max(...flat) < 0.5, "the room alone never reads as a loud voice");
});

test("voice levels save as one character a reading and read back", () => {
  const text = encodeVoiceLevels([0, 0.5, 1, 1.4, -1]);
  assert.equal(text, "0izz0");
  const back = decodeVoiceLevels(text);
  assert.equal(back.length, 5);
  near(back[1], 0.5);
  assert.equal(back[2], 1);
  assert.equal(decodeVoiceLevels("?")[0], 0, "anything else reads as silence");
});

test("the level at a moment eases between readings and is silent outside the recording", () => {
  const levels = [0, 1, 0];
  const mid = (n: number) => (n + 0.5) / VOICE_LEVELS_PER_SECOND;
  near(voiceLevelAt(levels, mid(1)), 1);
  near(voiceLevelAt(levels, (mid(0) + mid(1)) / 2), 0.5);
  assert.equal(voiceLevelAt(levels, 10), 0);
  assert.equal(voiceLevelAt(levels, -1), 0);
  assert.equal(voiceLevelAt([], 0.5), 0);
});
