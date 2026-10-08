import { test } from "node:test";
import assert from "node:assert/strict";
import { workoutSteps, type EstimateExercise, type WorkoutBlock } from "./workouts.ts";
import {
  activeTime,
  initialPlayerState,
  isFinished,
  isRunning,
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

test("back from the first exercise returns to the warm-up, if the workout began with it", () => {
  let s = run([{ type: "begin", warmup: true, mode: "off", now: 0 }, { type: "endWarmup", now: 1000 }]);
  assert.equal(s.phase, "workout");
  const take = s.take;
  s = run([{ type: "back", now: 2000 }], s);
  assert.equal(s.phase, "warmup");
  assert.equal(s.take, take + 1, "from the top");
  // Without the warm-up, back restarts the first set.
  s = run([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "back", now: 1000 }]);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 0);
  // "Restart this set" stays on the set.
  s = run([{ type: "begin", warmup: true, mode: "off", now: 0 }, { type: "endWarmup", now: 1000 }, { type: "restartSet", now: 2000 }]);
  assert.equal(s.phase, "workout");
});

test("the warm-up can start over: asking holds it, restarting plays it from the top", () => {
  let s = run([{ type: "begin", warmup: true, mode: "off", now: 0 }]);
  const take = s.take;
  s = run([{ type: "sheet", sheet: "restartVideo", now: 5000 }], s);
  assert.equal(isRunning(s), false, "held while asking");
  s = run([{ type: "restartVideo", now: 6000 }], s);
  assert.equal(s.phase, "warmup");
  assert.equal(s.sheet, null);
  assert.equal(isRunning(s), true);
  assert.equal(s.take, take + 1, "the clip starts over");
  // Only during the warm-up.
  s = run([{ type: "endWarmup", now: 7000 }, { type: "restartVideo", now: 8000 }], s);
  assert.equal(s.phase, "workout");
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

test("restarting the workout starts with the warm-up when it's on", () => {
  let s = run([
    { type: "begin", warmup: true, mode: "off", now: 0 },
    { type: "endWarmup", now: 1000 },
    { type: "jump", step: 3, now: 2000 },
    { type: "restartWorkout", warmup: true, now: 60_000 },
  ]);
  assert.equal(s.phase, "warmup");
  assert.equal(s.step, 0);
  assert.equal(activeTime(s, 60_000), 0, "the clock starts over");
  // Then the first exercise, and back from it returns to the warm-up.
  s = run([{ type: "endWarmup", now: 61_000 }, { type: "back", now: 62_000 }], s);
  assert.equal(s.phase, "warmup");
  // Without the warm-up: straight to the first exercise, and back stays there.
  s = run([{ type: "restartWorkout", now: 63_000 }, { type: "back", now: 64_000 }], s);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 0);
});

test("jumping from the warm-up (its overview) goes straight to that step", () => {
  let s = run([
    { type: "begin", warmup: true, mode: "loop", now: 0 },
    { type: "sheet", sheet: "overview", now: 1000 },
    { type: "jump", step: 3, now: 2000 },
  ]);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 3);
  assert.equal(s.sheet, null, "the overview closes");
  assert.equal(isRunning(s), true);
  // Back from the first exercise still returns to the warm-up afterwards.
  s = run([{ type: "jump", step: 0, now: 3000 }, { type: "back", now: 4000 }], s);
  assert.equal(s.phase, "warmup");
});

test("restarting during a tutorial plays the tutorial again", () => {
  let s = run([{ type: "begin", warmup: false, mode: "loop", now: 0 }, { type: "pause", now: 5000 }]);
  assert.equal(s.stage, "tutorial");
  const take = s.take;
  s = run([{ type: "restartSet", now: 6000 }], s);
  assert.equal(s.stage, "tutorial", "still the tutorial, not the set");
  assert.equal(s.step, 0);
  assert.equal(s.take, take + 1, "from its start");
  assert.equal(isRunning(s), true);
});

test("a first-time member's gesture guide opens before the warm-up, and not again after it", () => {
  let s = run([{ type: "begin", warmup: true, mode: "off", guide: true, now: 0 }]);
  assert.equal(s.phase, "warmup");
  assert.equal(s.sheet, "guide", "over the warm-up, straight away");
  assert.equal(isRunning(s), false, "the warm-up waits while it's open");
  s = run([{ type: "sheet", sheet: null, now: 1000 }, { type: "endWarmup", now: 2000 }], s);
  assert.equal(s.sheet, null, "not again at the first exercise");
});

test("without a warm-up, the gesture guide opens as the first exercise comes up", () => {
  let s = run([{ type: "begin", warmup: false, mode: "off", guide: true, now: 1000 }]);
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

test("auto-advance moves a rep set on after the time the reps take", () => {
  // Row set 1: 10 reps × 2.5 s = 25 s (getting into position is the get-ready countdown's job).
  let s = run([{ type: "begin", warmup: false, mode: "off", autoAdvance: true, now: 0 }]);
  assert.equal(s.step, 0);
  assert.equal(timerLeft(s, 0), 25_000);
  s = run([{ type: "tick", now: 24_000 }], s);
  assert.equal(s.step, 0, "not yet");
  s = run([{ type: "tick", now: 25_000 }], s);
  assert.equal(steps[s.step].kind, "rest", "on to the rest after it");
});

test("without auto-advance a rep set waits for a tap; turning it on starts the countdown", () => {
  let s = run([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "tick", now: 600_000 }]);
  assert.equal(s.step, 0);
  assert.equal(s.timer, null);
  s = run([{ type: "autoAdvance", on: true, now: 600_000 }], s);
  assert.equal(timerLeft(s, 600_000), 25_000);
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

test("resuming starts at the saved set, skips the warm-up, and keeps the time done", () => {
  // Saved on row set 2: no tutorial (the row came up already), time carried over.
  let s = run([{ type: "begin", warmup: true, mode: "loop", from: 2, activeMs: 90_000, now: 0 }]);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 2);
  assert.equal(s.stage, "exercise");
  assert.equal(activeTime(s, 10_000), 100_000);
  // Going back to set 1 doesn't replay its tutorial either.
  s = run([{ type: "back", now: 10_000 }], s);
  assert.equal(s.step, 0);
  assert.equal(s.stage, "exercise");
  // Saved on the lunge: its first appearance, so its tutorial shows.
  s = run([{ type: "begin", warmup: false, mode: "loop", from: 4, now: 0 }]);
  assert.equal(s.step, 4);
  assert.equal(s.stage, "tutorial");
  // Saved on a rest: the set after it.
  s = run([{ type: "begin", warmup: false, mode: "off", from: 1, now: 0 }]);
  assert.equal(s.step, 2);
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

// With a 3-second get-ready before exercises.
const ready = playerReducer({ steps, hasTutorial: (id) => id !== "plank", readyMs: 3000 });
function runReady(actions: PlayerAction[], from: PlayerState = initialPlayerState): PlayerState {
  return actions.reduce(ready, from);
}

test("get ready counts down before the first exercise, then it starts", () => {
  let s = runReady([{ type: "begin", warmup: false, mode: "off", now: 0 }]);
  assert.equal(s.stage, "ready");
  assert.equal(timerLeft(s, 1000), 2000);
  s = runReady([{ type: "tick", now: 2999 }], s);
  assert.equal(s.stage, "ready");
  s = runReady([{ type: "tick", now: 3000 }], s);
  assert.equal(s.stage, "exercise");
  assert.equal(s.step, 0);
  assert.equal(s.timer, null, "a rep set without auto-advance waits for a tap");
});

test("get ready also comes after the warm-up and after a tutorial, and Start now skips it", () => {
  let s = runReady([{ type: "begin", warmup: true, mode: "off", now: 0 }, { type: "endWarmup", now: 1000 }]);
  assert.equal(s.stage, "ready", "after the warm-up");
  s = runReady([{ type: "begin", warmup: false, mode: "loop", now: 0 }]);
  assert.equal(s.stage, "tutorial");
  s = runReady([{ type: "next", now: 1000 }], s);
  assert.equal(s.stage, "ready", "after the tutorial");
  s = runReady([{ type: "next", now: 1500 }], s);
  assert.equal(s.stage, "exercise", "Start now");
});

test("after a rest there's no get ready — the rest was the countdown", () => {
  let s = runReady([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "next", now: 1000 }, { type: "next", now: 2000 }]);
  assert.equal(steps[s.step].kind, "rest");
  s = runReady([{ type: "tick", now: 32_000 }], s);
  assert.equal(s.step, 2);
  assert.equal(s.stage, "exercise");
});

test("a rest into a different exercise still gets ready, tutorials off", () => {
  // Plank 45 s · rest 30 s · row 10 reps.
  const between = workoutSteps(
    [
      { kind: "exercise", move: { exerciseId: "plank", measure: "time", amount: 45, firstSide: "right" }, sets: 1, restBetweenSets: 0 },
      { kind: "rest", seconds: 30 },
      { kind: "exercise", move: { exerciseId: "row", measure: "reps", amount: 10, firstSide: "right" }, sets: 1, restBetweenSets: 0 },
    ],
    exercises,
  );
  const r = playerReducer({ steps: between, hasTutorial: () => false, readyMs: 3000 });
  const actions: PlayerAction[] = [
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "next", now: 1000 }, // Start now
    { type: "next", now: 2000 }, // on to the rest
  ];
  let s = actions.reduce(r, initialPlayerState);
  assert.equal(between[s.step].kind, "rest");
  s = r(s, { type: "tick", now: 32_000 });
  assert.equal(s.step, 2);
  assert.equal(s.stage, "ready", "the row is new: get ready for it");
});

test("a timed set's clock starts after get ready, and it gets ready between sides", () => {
  // Plank (45 s) follows row set 2 with no rest.
  let s = runReady([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "jump", step: 3, now: 0 }]);
  assert.equal(s.stage, "ready");
  s = runReady([{ type: "tick", now: 3000 }], s);
  assert.equal(s.stage, "exercise");
  assert.equal(timerLeft(s, 3000), 45_000, "the full 45 seconds");
  // Lunge right (20 s), then left: get ready for each side.
  s = runReady([{ type: "tick", now: 48_000 }, { type: "tick", now: 51_000 }, { type: "tick", now: 71_000 }], s);
  assert.equal(s.step, 5, "on to the left side");
  assert.equal(s.stage, "ready");
});

test("pausing holds the get-ready countdown; going back gets ready again", () => {
  let s = runReady([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "pause", now: 1000 }, { type: "tick", now: 60_000 }]);
  assert.equal(s.stage, "ready");
  s = runReady([{ type: "resume", now: 60_000 }], s);
  assert.equal(timerLeft(s, 60_000), 2000);
  s = runReady([{ type: "next", now: 60_000 }, { type: "back", now: 61_000 }], s);
  assert.equal(s.step, 0);
  assert.equal(s.stage, "ready");
});


// ── Intro, cool-down and outro ────────────────────────

// The same workout with an intro, a cool-down and an outro.
const extras = playerReducer({ steps, hasTutorial: () => false, hasIntro: true, hasCooldown: true, hasOutro: true });
function runExtras(actions: PlayerAction[], from: PlayerState = initialPlayerState): PlayerState {
  return actions.reduce(extras, from);
}
// To the last step (the lunge's left side, 20 s) and through it.
const toTheEnd: PlayerAction[] = [
  { type: "jump", step: 5, now: 1000 },
  { type: "tick", now: 21_000 },
];

test("the intro plays first, then the warm-up when it's on, then the exercises", () => {
  let s = runExtras([{ type: "begin", warmup: true, mode: "off", now: 0 }]);
  assert.equal(s.phase, "intro");
  assert.equal(isRunning(s), true);
  s = runExtras([{ type: "clipEnded", now: 30_000 }], s);
  assert.equal(s.phase, "warmup");
  s = runExtras([{ type: "next", now: 31_000 }], s);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 0);
  // Without the warm-up, Skip intro goes straight to the first exercise.
  s = runExtras([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "next", now: 1000 }]);
  assert.equal(s.phase, "workout");
  assert.equal(activeTime(s, 1000), 0, "the intro isn't workout time");
});

test("the guide opens over the intro; a resume or a restart skips the intro", () => {
  let s = runExtras([{ type: "begin", warmup: true, mode: "off", guide: true, now: 0 }]);
  assert.equal(s.phase, "intro");
  assert.equal(s.sheet, "guide");
  assert.equal(isRunning(s), false, "the intro waits while it's open");
  s = runExtras([{ type: "begin", warmup: true, mode: "off", from: 3, now: 0 }]);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 3);
  s = runExtras([{ type: "restartWorkout", warmup: true, now: 5000 }], s);
  assert.equal(s.phase, "warmup");
  s = runExtras([{ type: "restartWorkout", now: 6000 }], s);
  assert.equal(s.phase, "workout");
});

test("after the last exercise it asks about the cool-down; yes plays it, then the outro, then the summary", () => {
  let s = runExtras([{ type: "begin", warmup: false, mode: "off", from: 3, now: 0 }, ...toTheEnd]);
  assert.equal(s.phase, "cooldownPrompt");
  assert.equal(isFinished(s.phase), true, "the workout counts as done here");
  assert.equal(isRunning(s), false, "nothing plays while it asks");
  const time = activeTime(s, 21_000);
  s = runExtras([{ type: "next", now: 22_000 }, { type: "tick", now: 99_000 }], s);
  assert.equal(s.phase, "cooldownPrompt", "only an answer moves it on");
  s = runExtras([{ type: "chooseCooldown", yes: true, now: 25_000 }], s);
  assert.equal(s.phase, "cooldown");
  assert.equal(isRunning(s), true);
  s = runExtras([{ type: "clipEnded", now: 325_000 }], s);
  assert.equal(s.phase, "outro");
  s = runExtras([{ type: "clipEnded", now: 355_000 }], s);
  assert.equal(s.phase, "complete");
  assert.equal(activeTime(s, 400_000), time, "the cool-down and outro aren't workout time");
});

test("no to the cool-down goes to the outro; without one, it's the summary", () => {
  let s = runExtras([{ type: "begin", warmup: false, mode: "off", from: 3, now: 0 }, ...toTheEnd]);
  s = runExtras([{ type: "chooseCooldown", yes: false, now: 22_000 }], s);
  assert.equal(s.phase, "outro");
  s = runExtras([{ type: "next", now: 23_000 }], s);
  assert.equal(s.phase, "complete", "Skip outro");
  const noOutro = playerReducer({ steps, hasTutorial: () => false, hasCooldown: true });
  const actions: PlayerAction[] = [
    { type: "begin", warmup: false, mode: "off", from: 3, now: 0 },
    ...toTheEnd,
    { type: "chooseCooldown", yes: false, now: 22_000 },
  ];
  assert.equal(actions.reduce(noOutro, initialPlayerState).phase, "complete");
});

test("without a cool-down the outro follows the last exercise straight away", () => {
  const outroOnly = playerReducer({ steps, hasTutorial: () => false, hasOutro: true });
  const actions: PlayerAction[] = [{ type: "begin", warmup: false, mode: "off", from: 3, now: 0 }, ...toTheEnd];
  const s = actions.reduce(outroOnly, initialPlayerState);
  assert.equal(s.phase, "outro");
});

test("the cool-down and outro can be paused, restarted, skipped, or finished early", () => {
  let s = runExtras([
    { type: "begin", warmup: false, mode: "off", from: 3, now: 0 },
    ...toTheEnd,
    { type: "chooseCooldown", yes: true, now: 22_000 },
    { type: "pause", now: 30_000 },
  ]);
  assert.equal(s.paused, true);
  const take = s.take;
  s = runExtras([{ type: "restartVideo", now: 31_000 }], s);
  assert.equal(s.phase, "cooldown");
  assert.equal(s.take, take + 1, "from the top");
  assert.equal(isRunning(s), true);
  s = runExtras([{ type: "next", now: 32_000 }], s);
  assert.equal(s.phase, "outro", "Skip cool-down");
  s = runExtras([{ type: "finish", now: 33_000 }], s);
  assert.equal(s.phase, "complete", "End workout goes to the summary");
  // Finish does nothing before the exercises are done.
  s = runExtras([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "finish", now: 1000 }]);
  assert.equal(s.phase, "intro");
});

test("the Audio card doesn't hold the workout, and stays open as it moves on", () => {
  let s = run([
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "jump", step: 3, now: 0 }, // plank, 45 s
    { type: "sheet", sheet: "audio", now: 10_000 },
  ]);
  assert.equal(isRunning(s), true);
  assert.equal(timerLeft(s, 20_000), 25_000, "the countdown keeps going");
  s = run([{ type: "tick", now: 45_000 }], s);
  assert.equal(s.step, 4, "the plank ended on time");
  assert.equal(s.sheet, "audio", "still open over the next set");
  assert.equal(activeTime(s, 45_000), 45_000, "the workout clock never stopped");
  // Settings, unlike it, holds everything.
  s = run([{ type: "sheet", sheet: "settings", now: 50_000 }, { type: "tick", now: 200_000 }], s);
  assert.equal(isRunning(s), false);
  assert.equal(s.step, 4);
});

// ── The rundown (the workout overview) ────────────────

// 8 s of tip and 3 s after it.
const withRundown = playerReducer({ steps, hasTutorial: () => false, hasIntro: true, rundownMs: 11_000 });
const runRundown = (actions: PlayerAction[], from: PlayerState = initialPlayerState) => actions.reduce(withRundown, from);

test("the rundown comes after the intro, counts down, then the first exercise", () => {
  let s = runRundown([{ type: "begin", warmup: false, mode: "off", now: 0 }]);
  assert.equal(s.phase, "intro");
  s = runRundown([{ type: "clipEnded", now: 20_000 }], s);
  assert.equal(s.phase, "rundown");
  assert.equal(isRunning(s), true);
  assert.equal(timerLeft(s, 25_000), 6000);
  // Not yet…
  s = runRundown([{ type: "tick", now: 30_000 }], s);
  assert.equal(s.phase, "rundown");
  // …then on to the first exercise, the workout clock only starting there.
  s = runRundown([{ type: "tick", now: 31_000 }], s);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 0);
  assert.equal(activeTime(s, 31_000), 0);
});

test("Continue ends the rundown early; without an intro it comes first", () => {
  let s = runRundown([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "next", now: 1000 }]);
  assert.equal(s.phase, "rundown", "Next on the intro skips it, into the rundown");
  s = runRundown([{ type: "next", now: 2000 }], s);
  assert.equal(s.phase, "workout");
  const noIntro = playerReducer({ steps, hasTutorial: () => false, rundownMs: 11_000 });
  s = noIntro(initialPlayerState, { type: "begin", warmup: false, mode: "off", now: 0 });
  assert.equal(s.phase, "rundown");
});

test("pausing the rundown holds its countdown; restarting it starts it over", () => {
  let s = runRundown([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "next", now: 0 }]);
  s = runRundown([{ type: "pause", now: 4000 }], s);
  assert.equal(isRunning(s), false);
  s = runRundown([{ type: "tick", now: 60_000 }], s);
  assert.equal(s.phase, "rundown", "held");
  s = runRundown([{ type: "resume", now: 60_000 }], s);
  assert.equal(timerLeft(s, 60_000), 7000);
  const take = s.take;
  s = runRundown([{ type: "restartVideo", now: 61_000 }], s);
  assert.equal(s.phase, "rundown");
  assert.equal(timerLeft(s, 61_000), 11_000);
  assert.equal(s.take, take + 1);
});

test("a resume and a restart skip the rundown; the guide opens over it when it's first", () => {
  let s = runRundown([{ type: "begin", warmup: false, mode: "off", from: 2, now: 0 }]);
  assert.equal(s.phase, "workout");
  assert.equal(s.step, 2);
  s = runRundown([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "next", now: 0 }, { type: "next", now: 0 }]);
  s = runRundown([{ type: "restartWorkout", now: 5000 }], s);
  assert.equal(s.phase, "workout");
  const noIntro = playerReducer({ steps, hasTutorial: () => false, rundownMs: 11_000 });
  s = noIntro(initialPlayerState, { type: "begin", warmup: false, mode: "off", guide: true, now: 0 });
  assert.equal(s.phase, "rundown");
  assert.equal(s.sheet, "guide");
  assert.equal(isRunning(s), false, "held until the guide closes");
});

test("without a rundown, the intro goes straight on to the exercises", () => {
  const s = extras(extras(initialPlayerState, { type: "begin", warmup: false, mode: "off", now: 0 }), { type: "clipEnded", now: 1000 });
  assert.equal(s.phase, "workout");
});

// A set's voice announcement holds its countdown: 3 s before every set here.
const announced = playerReducer({
  steps,
  hasTutorial: () => false,
  exerciseLeadMs: (i) => (steps[i].kind === "set" ? 3000 : 0),
});
function runAnnounced(actions: PlayerAction[], from: PlayerState = initialPlayerState): PlayerState {
  return actions.reduce(announced, from);
}

test("a set's announcement holds its countdown, which shows the set's full time meanwhile", () => {
  // The plank: 45 s.
  let s = runAnnounced([{ type: "begin", warmup: false, mode: "off", now: 0 }, { type: "jump", step: 3, now: 0 }]);
  assert.equal(s.step, 3);
  assert.equal(timerLeft(s, 0), 45_000);
  assert.equal(timerLeft(s, 2_900), 45_000, "held while it's said");
  assert.equal(timerLeft(s, 4_000), 44_000, "then counting");
  s = runAnnounced([{ type: "tick", now: 47_900 }], s);
  assert.equal(s.step, 3, "the whole 45 s, after the hold");
  s = runAnnounced([{ type: "tick", now: 48_000 }], s);
  assert.equal(s.step, 4);
});

test("pausing during an announcement keeps what's left of its hold", () => {
  let s = runAnnounced([
    { type: "begin", warmup: false, mode: "off", now: 0 },
    { type: "jump", step: 3, now: 0 },
    { type: "pause", now: 1_000 },
  ]);
  assert.equal(timerLeft(s, 9_000), 45_000);
  s = runAnnounced([{ type: "resume", now: 10_000 }], s);
  assert.equal(timerLeft(s, 11_900), 45_000, "2 of the 3 s held so far");
  assert.equal(timerLeft(s, 13_000), 44_000);
});

test("a rep set on auto-advance is held too; a rest isn't", () => {
  // Row: 10 reps at 2.5 s, so 25 s.
  let s = runAnnounced([{ type: "begin", warmup: false, mode: "off", autoAdvance: true, now: 0 }]);
  assert.equal(s.step, 0);
  assert.equal(timerLeft(s, 2_000), 25_000);
  assert.equal(timerLeft(s, 4_000), 24_000);
  s = runAnnounced([{ type: "tick", now: 28_000 }], s);
  assert.equal(s.step, 1, "on to the rest");
  assert.equal(timerLeft(s, 29_000), 29_000, "the rest counts from its start");
});
