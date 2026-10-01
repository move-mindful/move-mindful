import { test } from "node:test";
import assert from "node:assert/strict";
import { speechBounds } from "./audio-trim.ts";

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
