import { test } from "node:test";
import assert from "node:assert/strict";
import { workoutSteps, type EstimateExercise, type WorkoutBlock } from "./workouts.ts";
import { resumeFrom, sequenceKey, workoutProgress } from "./workout-progress.ts";

const exercises: Record<string, EstimateExercise> = {
  row: { sided: false, paceSeconds: 2.5, tutorialSeconds: 40 },
  plank: { sided: false, paceSeconds: null, tutorialSeconds: null },
  lunge: { sided: true, paceSeconds: 3, tutorialSeconds: 30 },
};

const row = (amount: number, sets = 2): WorkoutBlock => ({
  kind: "exercise",
  move: { exerciseId: "row", measure: "reps", amount, firstSide: "right" },
  sets,
  restBetweenSets: 30,
});
const plank: WorkoutBlock = {
  kind: "exercise",
  move: { exerciseId: "plank", measure: "time", amount: 45, firstSide: "right" },
  sets: 1,
  restBetweenSets: 0,
};
const lunge: WorkoutBlock = {
  kind: "exercise",
  move: { exerciseId: "lunge", measure: "time", amount: 20, firstSide: "right" },
  sets: 1,
  restBetweenSets: 0,
};

// 0 row set 1 · 1 rest · 2 row set 2 · 3 plank · 4 lunge right · 5 lunge left
const steps = workoutSteps([row(10), plank, lunge], exercises);
const total = steps.reduce((sum, s) => sum + s.seconds, 0);

test("progress counts sets done and the share of the estimated time", () => {
  assert.deepEqual(workoutProgress(steps, 0), { setsDone: 0, setsTotal: 4, percent: 0 });
  const atPlank = workoutProgress(steps, 3);
  assert.equal(atPlank.setsDone, 2);
  assert.equal(atPlank.percent, Math.round((100 * (steps[0].seconds + steps[1].seconds + steps[2].seconds)) / total));
  // Halfway through a sided set it isn't done yet.
  assert.equal(workoutProgress(steps, 5).setsDone, 3);
  // A rest counts toward the set after it.
  assert.equal(workoutProgress(steps, 1).setsDone, 1);
  assert.deepEqual(workoutProgress(steps, steps.length), { setsDone: 4, setsTotal: 4, percent: 100 });
});

test("progress never shows 100% before the end", () => {
  assert.ok(workoutProgress(steps, steps.length - 1).percent <= 99);
});

test("the sequence key survives new amounts but not a changed sequence", () => {
  const key = sequenceKey(steps);
  assert.match(key, /^[0-9a-f]{8}$/);
  assert.equal(sequenceKey(workoutSteps([row(12), plank, lunge], exercises)), key, "more reps: same places");
  assert.notEqual(sequenceKey(workoutSteps([row(10, 3), plank, lunge], exercises)), key, "a set added");
  assert.notEqual(sequenceKey(workoutSteps([plank, row(10), lunge], exercises)), key, "reordered");
});

test("resume picks up at the set it was on, or the one after a rest", () => {
  const key = sequenceKey(steps);
  assert.equal(resumeFrom(steps, { step: 3, sequenceKey: key }), 3);
  assert.equal(resumeFrom(steps, { step: 1, sequenceKey: key }), 2, "saved on a rest");
  assert.equal(resumeFrom(steps, { step: 0, sequenceKey: key }), null, "nothing done yet");
  assert.equal(resumeFrom(steps, { step: 99, sequenceKey: key }), null, "out of range");
  assert.equal(resumeFrom(steps, { step: 3, sequenceKey: "00000000" }), null, "the workout changed");
});
