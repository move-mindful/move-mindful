import { test } from "node:test";
import assert from "node:assert/strict";
import { workoutSteps, type EstimateExercise, type WorkoutBlock } from "./workouts.ts";
import {
  activeTime,
  initialPlayerState,
  playerReducer,
  timerLeft,
  type PlayerAction,
  type PlayerState,
} from "./workout-player.ts";

const exercises: Record<string, EstimateExercise> = {
  row: { sided: false, paceSeconds: 2.5, tutorialSeconds: 40 },
  plank: { sided: false, paceSeconds: null, tutorialSeconds: null },
  lunge: { sided: true, paceSeconds: 3, tutorialSeconds: 30 },
};

// Row: 2 sets of 10 reps with 30 s rest · plank 45 s · lunge 20 s each side.
const blocks: WorkoutBlock[] = [
  { kind: "exercise", move: { exerciseId: "row", measure: "reps", amount: 10, firstSide: "right" }, sets: 2, restBetweenSets: 30 },
  { kind: "exercise", move: { exerciseId: "plank", measure: "time", amount: 45, firstSide: "right" }, sets: 1, restBetweenSets: 0 },
  { kind: "exercise", move: { exerciseId: "lunge", measure: "time", amount: 20, firstSide: "right" }, sets: 1, restBetweenSets: 0 },
];
const steps = workoutSteps(blocks, exercises);
// 0 row set 1 · 1 rest · 2 row set 2 · 3 plank · 4 lunge right · 5 lunge left
const reducer = playerReducer({ steps, hasTutorial: (id) => id !== "plank" });

function run(actions: PlayerAction[], from: PlayerState = initialPlayerState): PlayerState {
  return actions.reduce(reducer, from);
}

test("the first exercise opens on its tutorial, then Next starts it", () => {
  let s = run([{ type: "begin", warmup: false, mode: "loop", now: 0 }]);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 0);
  assert.equal(s.stage, "tutorial");
  s = run([{ type: "next", now: 5000 }], s);
  assert.equal(s.stage, "exercise");
  assert.equal(s.step, 0);
});

test("with tutorials off, it goes straight to the exercise", () => {
  const s = run([{ type: "begin", warmup: false, mode: "off", now: 0 }]);
  assert.equal(s.stage, "exercise");
});

test("the warm-up comes first when chosen", () => {
  let s = run([{ type: "begin", warmup: true, mode: "off", now: 0 }]);
  assert.equal(s.phase, "warmup");
  s = run([{ type: "endWarmup", now: 1000 }], s);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 0);
});

test("the warm-up video ending starts the workout", () => {
  const s = run([
    { type: "begin", warmup: true, mode: "loop", now: 0 },
    { type: "clipEnded", now: 270_000 },
  ]);
  assert.equal(s.phase, "workout");
  assert.equal(s.stage, "tutorial", "and a looping tutorial doesn't end on that same event");
});

test("a rest counts down and moves on by itself", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "next", now: 1000 }, // finish set 1 → rest
  ]);
  assert.equal(steps[s.step].kind, "rest");
  assert.equal(timerLeft(s, 11_000), 20_000);
  s = run([{ type: "tick", now: 20_000 }], s);
  assert.equal(s.step, 1, "still resting");
  s = run([{ type: "tick", now: 31_000 }], s);
  assert.equal(s.step, 2);
});

test("pausing freezes the countdown and the workout clock", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "jump", step: 3, now: 0 }, // plank, 45 s
    { type: "pause", now: 10_000 },
    { type: "tick", now: 100_000 },
  ]);
  assert.equal(s.step, 3);
  assert.equal(timerLeft(s, 100_000), 35_000);
  assert.equal(activeTime(s, 100_000), 10_000);
  s = run([{ type: "resume", now: 100_000 }, { type: "tick", now: 135_000 }], s);
  assert.equal(s.step, 4, "the plank ended 35 s after resuming");
});

test("back skips rests, and restarts the first set", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "jump", step: 2, now: 0 },
    { type: "back", now: 1000 },
  ]);
  assert.equal(s.step, 0);
  s = run([{ type: "back", now: 2000 }], s);
  assert.equal(s.step, 0);
});

test("a tutorial comes up once; going back doesn't replay it", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "loop", now: 0 },
    { type: "next", now: 1 }, // start row
    { type: "jump", step: 4, now: 2 }, // forward to the lunge
  ]);
  assert.equal(s.stage, "tutorial");
  s = run([{ type: "back", now: 3 }, { type: "jump", step: 4, now: 4 }], s);
  assert.equal(s.stage, "exercise");
});

test("a tutorial playing once starts the exercise when it ends", () => {
  let s = run([{ type: "begin", warmup: false, mode: "once", now: 0 }]);
  assert.equal(s.tutorialPlay, "once");
  s = run([{ type: "clipEnded", now: 40_000 }], s);
  assert.equal(s.stage, "exercise");
});

test("a sided exercise plays each side, then the workout completes", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "jump", step: 4, now: 0 },
    { type: "tick", now: 20_000 },
  ]);
  assert.equal(s.step, 5);
  s = run([{ type: "tick", now: 40_000 }], s);
  assert.equal(s.phase, "complete");
  assert.equal(activeTime(s, 99_000), 40_000);
});

test("changing the tutorial setting applies to the tutorial on screen", () => {
  let s = run([{ type: "begin", warmup: false, mode: "loop", now: 0 }]);
  s = run([{ type: "mode", mode: "once", now: 1 }], s);
  assert.equal(s.tutorialPlay, "once");
  s = run([{ type: "clipEnded", now: 40_000 }], s);
  assert.equal(s.stage, "exercise");
});

test("restarting the workout shows the tutorials again", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "loop", now: 0 },
    { type: "next", now: 1 }, // past the row's tutorial
    { type: "jump", step: 4, now: 2 }, // the lunge's tutorial
    { type: "next", now: 3 },
    { type: "restartWorkout", now: 4 },
  ]);
  assert.equal(s.step, 0);
  assert.equal(s.stage, "tutorial");
  assert.deepEqual(s.seen, ["row"]);
  s = run([{ type: "jump", step: 4, now: 5 }], s);
  assert.equal(s.stage, "tutorial", "the lunge's too");
  // Restarting a set doesn't.
  s = run([{ type: "next", now: 6 }, { type: "restartSet", now: 7 }], s);
  assert.equal(s.stage, "exercise");
});

test("a first-time member's gesture guide opens as the first exercise comes up", () => {
  let s = run([{ type: "begin", warmup: true, mode: "off", guide: true, now: 0 }]);
  assert.equal(s.sheet, null, "not over the warm-up");
  s = run([{ type: "endWarmup", now: 1000 }], s);
  assert.equal(s.sheet, "guide");
  s = run([{ type: "jump", step: 3, now: 2000 }], s); // the plank, 45 s — held while the guide is open
  assert.equal(s.sheet, null, "moving on closes it");
  s = run([{ type: "sheet", sheet: "guide", now: 3000 }, { type: "tick", now: 100_000 }], s);
  assert.equal(s.step, 3, "the clock waits while it's open");
  s = run([{ type: "sheet", sheet: null, now: 100_000 }, { type: "restartWorkout", now: 100_000 }], s);
  assert.equal(s.sheet, null, "and it doesn't come back on a restart");
});

test("ending the workout goes back to the preview", () => {
  const s = run([
    { type: "begin", warmup: false, mode: "once", now: 0 },
    { type: "jump", step: 3, now: 1000 },
    { type: "pause", now: 2000 },
    { type: "sheet", sheet: "end", now: 2000 },
    { type: "exit", now: 3000 },
  ]);
  assert.equal(s.phase, "preview");
  assert.equal(s.sheet, null);
  assert.equal(s.paused, false);
  assert.equal(s.timer, null);
  assert.equal(s.mode, "once", "the tutorial setting carries over");
});

test("auto-advance moves a rep set on after its estimated time", () => {
  // Row set 1: 10 reps × 2.5 s + 5 s to get into position = 30 s.
  let s = run([{ type: "begin", warmup: false, mode: "off", autoAdvance: true, now: 0 }]);
  assert.equal(s.step, 0);
  assert.equal(timerLeft(s, 0), 30_000);
  s = run([{ type: "tick", now: 29_000 }], s);
  assert.equal(s.step, 0, "not yet");
  s = run([{ type: "tick", now: 30_000 }], s);
  assert.equal(steps[s.step].kind, "rest", "on to the rest after it");
});

test("without auto-advance a rep set waits for a tap; turning it on starts the countdown", () => {
  let s = run([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "tick", now: 600_000 }]);
  assert.equal(s.step, 0);
  assert.equal(s.timer, null);
  s = run([{ type: "autoAdvance", on: true, now: 600_000 }], s);
  assert.equal(timerLeft(s, 600_000), 30_000);
  s = run([{ type: "autoAdvance", on: false, now: 610_000 }], s);
  assert.equal(s.timer, null);
});

test("auto-advance and Loop tutorials are never on together", () => {
  // Begun with both (settings saved before the rule): tutorials play once.
  let s = run([{ type: "begin", warmup: false, mode: "loop", autoAdvance: true, now: 0 }]);
  assert.equal(s.mode, "once");
  assert.equal(s.stage, "tutorial");
  assert.equal(s.tutorialPlay, "once");
  // Choosing Loop while it's on keeps Play once; Off is fine.
  s = run([{ type: "mode", mode: "loop", now: 1 }], s);
  assert.equal(s.mode, "once");
  s = run([{ type: "mode", mode: "off", now: 2 }], s);
  assert.equal(s.mode, "off");
  // Turning it on over a looping tutorial lets that tutorial play out once.
  s = run([{ type: "begin", warmup: false, mode: "loop", now: 0 }]);
  assert.equal(s.tutorialPlay, "loop");
  s = run([{ type: "autoAdvance", on: true, now: 1 }], s);
  assert.equal(s.mode, "once");
  assert.equal(s.tutorialPlay, "once");
  s = run([{ type: "clipEnded", now: 40_000 }], s);
  assert.equal(s.stage, "exercise");
  // Turning it off leaves Play once as it is.
  s = run([{ type: "autoAdvance", on: false, now: 41_000 }], s);
  assert.equal(s.mode, "once");
});

test("watching a tutorial again follows the tutorial setting", () => {
  // Play once: it plays through, then it's back to the exercise.
  let s = run([
    { type: "begin", warmup: false, mode: "once", now: 0 },
    { type: "clipEnded", now: 1000 },
    { type: "pause", now: 2000 },
    { type: "watchTutorial", now: 3000 },
  ]);
  assert.equal(s.stage, "tutorial");
  assert.equal(s.tutorialPlay, "once");
  s = run([{ type: "clipEnded", now: 40_000 }], s);
  assert.equal(s.stage, "exercise");
  // Loop: it waits for a tap.
  s = run([
    { type: "begin", warmup: false, mode: "loop", now: 0 },
    { type: "next", now: 1000 },
    { type: "watchTutorial", now: 2000 },
  ]);
  assert.equal(s.tutorialPlay, "loop");
});
