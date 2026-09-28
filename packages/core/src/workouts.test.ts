import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aboutMinutes,
  estimateWorkout,
  groupLabels,
  type EstimateExercise,
  type WorkoutBlock,
  type WorkoutMove,
} from "./workouts.ts";

const exercises: Record<string, EstimateExercise> = {
  row: { sided: false, paceSeconds: 2.5, tutorialSeconds: 40 },
  squat: { sided: true, paceSeconds: 3, tutorialSeconds: 50 },
  hold: { sided: false, paceSeconds: null, tutorialSeconds: null },
  unpaced: { sided: false, paceSeconds: null, tutorialSeconds: 30 },
};

const move = (exerciseId: string, measure: "reps" | "time", amount: number): WorkoutMove => ({
  exerciseId,
  measure,
  amount,
  firstSide: "right",
});

test("reps use the pace; each set adds 5 s to get into position", () => {
  const est = estimateWorkout([{ kind: "exercise", move: move("row", "reps", 12), sets: 3 }], exercises);
  assert.equal(est.exerciseSeconds, 12 * 2.5 * 3); // 90
  assert.equal(est.transitionSeconds, 3 * 5);
  assert.equal(est.restSeconds, 0);
  assert.equal(est.totalSeconds, 105);
});

test("a sided exercise counts both sides and a side switch", () => {
  const est = estimateWorkout([{ kind: "exercise", move: move("squat", "time", 30), sets: 2 }], exercises);
  assert.equal(est.exerciseSeconds, 30 * 2 * 2); // 30 s per side, 2 sets
  assert.equal(est.transitionSeconds, (5 + 3) * 2);
});

test("rest blocks add their length", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("hold", "time", 45), sets: 1 },
    { kind: "rest", seconds: 60 },
  ];
  const est = estimateWorkout(blocks, exercises);
  assert.equal(est.restSeconds, 60);
  assert.equal(est.totalSeconds, 45 + 5 + 60);
});

test("a group rests between exercises and between rounds, but not after the last", () => {
  const superset: WorkoutBlock = {
    kind: "group",
    rounds: 3,
    restBetweenExercises: 15,
    restBetweenRounds: 45,
    moves: [move("row", "reps", 12), move("squat", "time", 30)],
  };
  const est = estimateWorkout([superset], exercises);
  // Per round: row 30 s + squat 60 s (both sides).
  assert.equal(est.exerciseSeconds, (30 + 60) * 3);
  // One rest between the two exercises per round; round rests after rounds 1 and 2 only.
  assert.equal(est.restSeconds, 15 * 1 * 3 + 45 * 2);
  // Each exercise once per round: row 5 s, squat 5 s + 3 s switch.
  assert.equal(est.transitionSeconds, (5 + 8) * 3);
});

test("an unknown pace falls back to 3 s per rep and is reported", () => {
  const est = estimateWorkout([{ kind: "exercise", move: move("unpaced", "reps", 10), sets: 1 }], exercises);
  assert.equal(est.exerciseSeconds, 30);
  assert.deepEqual(est.missingPace, ["unpaced"]);
});

test("tutorials count once per exercise, however often it appears", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("row", "reps", 10), sets: 2 },
    { kind: "group", rounds: 2, restBetweenExercises: 0, restBetweenRounds: 0, moves: [move("row", "reps", 8), move("squat", "reps", 6)] },
  ];
  assert.equal(estimateWorkout(blocks, exercises).tutorialSeconds, 40 + 50);
});

test("an empty group adds nothing", () => {
  const est = estimateWorkout(
    [{ kind: "group", rounds: 3, restBetweenExercises: 10, restBetweenRounds: 30, moves: [] }],
    exercises,
  );
  assert.equal(est.totalSeconds, 0);
});

test("about minutes rounds, and is never zero", () => {
  assert.equal(aboutMinutes(951), 16); // 15:51
  assert.equal(aboutMinutes(20), 1);
});

test("groups are labelled Superset/Circuit, numbered per type", () => {
  const g = (n: number): WorkoutBlock => ({
    kind: "group",
    rounds: 1,
    restBetweenExercises: 0,
    restBetweenRounds: 0,
    moves: Array.from({ length: n }, () => move("row", "reps", 5)),
  });
  const blocks: WorkoutBlock[] = [g(2), { kind: "rest", seconds: 30 }, g(3), g(2), g(4)];
  assert.deepEqual(groupLabels(blocks), ["Superset 1", null, "Circuit 1", "Superset 2", "Circuit 2"]);
});
