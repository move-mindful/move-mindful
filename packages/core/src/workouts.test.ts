import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aboutMinutes,
  allTips,
  estimateWorkout,
  groupLabels,
  keepStepTips,
  secondsLeft,
  withTip,
  workoutSteps,
  type AudioTip,
  type EstimateExercise,
  type SetStep,
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
  const est = estimateWorkout([{ kind: "exercise", move: move("row", "reps", 12), sets: 3, restBetweenSets: 0 }], exercises);
  assert.equal(est.exerciseSeconds, 12 * 2.5 * 3); // 90
  assert.equal(est.transitionSeconds, 3 * 5);
  assert.equal(est.restSeconds, 0);
  assert.equal(est.totalSeconds, 105);
});

test("a sided exercise counts both sides and a side switch", () => {
  const est = estimateWorkout([{ kind: "exercise", move: move("squat", "time", 30), sets: 2, restBetweenSets: 0 }], exercises);
  assert.equal(est.exerciseSeconds, 30 * 2 * 2); // 30 s per side, 2 sets
  assert.equal(est.transitionSeconds, (5 + 3) * 2);
});

test("rest between sets comes after every set but the last", () => {
  const est = estimateWorkout(
    [{ kind: "exercise", move: move("row", "reps", 12), sets: 3, restBetweenSets: 30 }],
    exercises,
  );
  assert.equal(est.restSeconds, 30 * 2);
  assert.equal(est.totalSeconds, 90 + 15 + 60);
});

test("rest blocks add their length", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("hold", "time", 45), sets: 1, restBetweenSets: 0 },
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
  const est = estimateWorkout([{ kind: "exercise", move: move("unpaced", "reps", 10), sets: 1, restBetweenSets: 0 }], exercises);
  assert.equal(est.exerciseSeconds, 30);
  assert.deepEqual(est.missingPace, ["unpaced"]);
});

test("tutorials count once per exercise, however often it appears", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("row", "reps", 10), sets: 2, restBetweenSets: 0 },
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

test("steps: sets, sides and rests in play order", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("row", "reps", 12), sets: 2, restBetweenSets: 30 },
    { kind: "rest", seconds: 60 },
    {
      kind: "group",
      rounds: 2,
      restBetweenExercises: 10,
      restBetweenRounds: 45,
      moves: [move("hold", "time", 20), { ...move("squat", "time", 30), firstSide: "left" }],
    },
  ];
  const steps = workoutSteps(blocks, exercises);
  const shape = steps.map((s) =>
    s.kind === "rest" ? `rest ${s.reason} ${s.seconds}` : `${s.exerciseId} r${s.round} ${s.side ?? "-"} #${s.setIndex}`,
  );
  assert.deepEqual(shape, [
    "row r1 - #0",
    "rest set 30",
    "row r2 - #1",
    "rest block 60",
    "hold r1 - #2",
    "rest exercise 10",
    "squat r1 left #3",
    "squat r1 right #3",
    "rest round 45",
    "hold r2 - #4",
    "rest exercise 10",
    "squat r2 left #5",
    "squat r2 right #5",
  ]);
  // The tutorial goes before an exercise's first appearance only.
  const firsts = steps.filter((s) => s.kind === "set" && s.firstOfExercise).map((s) => (s as SetStep).exerciseId);
  assert.deepEqual(firsts, ["row", "hold", "squat"]);
  assert.equal((steps[6] as SetStep).groupLabel, "Superset 1");
});

test("step lengths add up to the estimate", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("squat", "reps", 8), sets: 3, restBetweenSets: 20 },
    { kind: "rest", seconds: 60 },
    {
      kind: "group",
      rounds: 3,
      restBetweenExercises: 15,
      restBetweenRounds: 45,
      moves: [move("row", "reps", 12), move("squat", "time", 30), move("unpaced", "reps", 10)],
    },
  ];
  const steps = workoutSteps(blocks, exercises);
  assert.equal(secondsLeft(steps, 0), estimateWorkout(blocks, exercises).totalSeconds);
  assert.equal(secondsLeft(steps, steps.length), 0);
});

test("steps drop rests at the edges and merge back-to-back rests", () => {
  const blocks: WorkoutBlock[] = [
    { kind: "rest", seconds: 30 },
    { kind: "exercise", move: move("hold", "time", 20), sets: 1, restBetweenSets: 0 },
    { kind: "rest", seconds: 30 },
    { kind: "rest", seconds: 15 },
    { kind: "exercise", move: move("hold", "time", 20), sets: 2, restBetweenSets: 0 },
    { kind: "rest", seconds: 60 },
  ];
  const kinds = workoutSteps(blocks, exercises).map((s) => (s.kind === "rest" ? `rest ${s.seconds}` : "set"));
  assert.deepEqual(kinds, ["set", "rest 45", "set", "set"]);
});

const tip = (id: string): AudioTip => ({ id, seconds: 6 });

test("each step finds its own tip: per set and side, and per rest", () => {
  const blocks: WorkoutBlock[] = [
    {
      kind: "exercise",
      move: { ...move("squat", "time", 20), tips: { "1:right": tip("s1R"), "2:left": tip("s2L") } },
      sets: 2,
      restBetweenSets: 30,
      restTips: { "2": tip("rest-before-set-2") },
    },
    { kind: "rest", seconds: 60, restTips: { rest: tip("block-rest") } },
    {
      kind: "group",
      rounds: 2,
      restBetweenExercises: 10,
      restBetweenRounds: 45,
      moves: [{ ...move("row", "reps", 8), tips: { "2": tip("row-r2") } }, move("hold", "time", 20)],
      restTips: { "1:1": tip("r1-between"), "2:0": tip("round-rest") },
    },
  ];
  const steps = workoutSteps(blocks, exercises);
  const shape = steps.map((s) => `${s.kind === "rest" ? "rest" : s.exerciseId} ${s.tipSlot.key} ${s.tip?.id ?? "-"}`);
  assert.deepEqual(shape, [
    "squat 1:right s1R",
    "squat 1:left -",
    "rest 2 rest-before-set-2",
    "squat 2:right -",
    "squat 2:left s2L",
    "rest rest block-rest",
    "row 1 -",
    "rest 1:1 r1-between",
    "hold 1 -",
    "rest 2:0 round-rest",
    "row 2 row-r2",
    "rest 2:1 -",
    "hold 2 -",
  ]);
  // A group's move tips live on that move, so they follow it when it's reordered.
  assert.deepEqual(steps[10].tipSlot, { block: 2, move: 0, key: "2" });
  assert.deepEqual(steps[5].tipSlot, { block: 1, move: null, key: "rest" });
});

test("a merged rest keeps the first rest's tip; withTip and keepStepTips edit the slots", () => {
  let blocks: WorkoutBlock[] = [
    { kind: "exercise", move: move("hold", "time", 20), sets: 1, restBetweenSets: 0 },
    { kind: "rest", seconds: 30, restTips: { rest: tip("first") } },
    { kind: "rest", seconds: 15, restTips: { rest: tip("second") } },
    { kind: "exercise", move: move("row", "reps", 10), sets: 3, restBetweenSets: 20 },
  ];
  const steps = workoutSteps(blocks, exercises);
  assert.equal(steps[1].kind === "rest" && steps[1].seconds, 45);
  assert.equal(steps[1].tip?.id, "first");

  // Record a tip on the third set, then clear the first rest's.
  const third = steps.find((s) => s.kind === "set" && s.exerciseId === "row" && s.round === 3)!;
  blocks = withTip(blocks, third.tipSlot, tip("row-3"));
  blocks = withTip(blocks, steps[1].tipSlot, null);
  let after = workoutSteps(blocks, exercises);
  assert.equal(after.find((s) => s.kind === "set" && s.round === 3)?.tip?.id, "row-3");
  assert.equal(after[1].tip, null);

  // Down to two sets: the third set's tip — and the merged-away rest's — are dropped.
  blocks = blocks.map((b) => (b.kind === "exercise" && b.move.exerciseId === "row" ? { ...b, sets: 2 } : b));
  after = workoutSteps(blocks, exercises);
  assert.deepEqual(allTips(keepStepTips(blocks, after)), []);
  assert.deepEqual(allTips(blocks).map((t) => t.id).sort(), ["row-3", "second"]);
});
