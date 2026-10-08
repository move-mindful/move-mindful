/**
 * Exercise-by-exercise workouts — the sequence model and its time estimate,
 * shared by the admin builder, the web player and (later) the iOS app so every
 * platform shows the same number. See plan.md, Phase 4.5.
 *
 * Self-contained on purpose (no relative imports), so the tests run on plain
 * Node: `npm test -w @move-mindful/core`.
 */

export type Side = "right" | "left";
export type Measure = "reps" | "time";

/**
 * A recorded audio tip from the instructor: the app's id for its file, and
 * how long it plays. With `start` and `end` (seconds into the file) only that
 * part plays — the speech, the dead air either side trimmed off (see
 * speechBounds) — and `seconds` is its length; without them, the whole file.
 * `levels`: how loud the voice is through the file, for the player's
 * equalizer bars (see voiceLevels / encodeVoiceLevels); without it, the bars
 * just move. `cues`: the workout overview's tip only — see TipCue.
 */
export interface AudioTip {
  id: string;
  seconds: number;
  start?: number;
  end?: number;
  levels?: string;
  cues?: TipCue[];
}

/**
 * On the workout overview's tip: the exercise the instructor turns to `at`
 * seconds into the file (the recording's own clock, so trimming doesn't move
 * it) — tapped in the builder while recording. In order; the overview shows
 * each from its cue until the next, and the last one on to the end.
 */
export interface TipCue {
  at: number;
  exerciseId: string;
}

/**
 * The cue in force `time` seconds into the tip's file: the last one at or
 * before it — before the first, the first. Null when there are none.
 */
export function cueAt(cues: TipCue[], time: number): TipCue | null {
  let current: TipCue | null = cues[0] ?? null;
  for (const cue of cues) {
    if (cue.at <= time) current = cue;
    else break;
  }
  return current;
}

/**
 * A move's or block's audio tips, by slot key. On a move, one per set (a
 * single exercise) or round (a group), and per side for a sided exercise:
 * "2", "2:left". On a block, one per rest: a rest block's own ("rest"), the
 * rest before a single exercise's set n ("n"), in a group the rest before
 * move m of round r ("r:m" — m = 0 is the rest between rounds), and the rest
 * between the sides of move m in set or round r ("r:m:side" — m = 0 for a
 * single exercise). Tips are optional everywhere; see TipSlot for how a step
 * finds its own.
 */
export type TipMap = Record<string, AudioTip>;

/**
 * One exercise as done in a workout. `amount` is reps or seconds — per side
 * for an exercise done on each side.
 */
export interface WorkoutMove {
  exerciseId: string;
  measure: Measure;
  amount: number;
  /** Sided exercises only. */
  firstSide: Side;
  /** Sided exercises only: seconds of rest between the two sides, every set (or round). None when 0 or missing. */
  restBetweenSides?: number;
  /** Tips for its sets (or rounds), by side when sided — see TipMap. */
  tips?: TipMap;
}

export type WorkoutBlock =
  /** A single exercise, done for `sets` sets with `restBetweenSets` between them. */
  | { kind: "exercise"; move: WorkoutMove; sets: number; restBetweenSets: number; restTips?: TipMap }
  /** A rest the admin placed between blocks. */
  | { kind: "rest"; seconds: number; restTips?: TipMap }
  /**
   * A superset (2 exercises) or circuit (3+): each exercise once per round.
   * `restBetweenExercises` follows every exercise except a round's last;
   * `restBetweenRounds` follows every round except the final one.
   */
  | {
      kind: "group";
      rounds: number;
      restBetweenExercises: number;
      restBetweenRounds: number;
      moves: WorkoutMove[];
      restTips?: TipMap;
    };

/** What the estimate needs to know about an exercise. */
export interface EstimateExercise {
  sided: boolean;
  /** Seconds per rep: the loop clip's length ÷ the reps it shows. Null when unknown. */
  paceSeconds: number | null;
  /** The tutorial's length in seconds, if it has one. */
  tutorialSeconds: number | null;
}

export interface EstimateOptions {
  /** Getting into position for each set (default 5 s). */
  secondsPerSet: number;
  /** Swapping sides on a sided exercise (default 3 s). */
  secondsPerSideSwitch: number;
  /** Used for reps when an exercise's pace isn't known yet (default 3 s). */
  fallbackPaceSeconds: number;
}

export const DEFAULT_ESTIMATE_OPTIONS: EstimateOptions = {
  secondsPerSet: 5,
  secondsPerSideSwitch: 3,
  fallbackPaceSeconds: 3,
};

export interface WorkoutEstimate {
  /** Time spent doing the exercises. */
  exerciseSeconds: number;
  /** Rest blocks, the rests between sets and sides, and the rests inside supersets and circuits. */
  restSeconds: number;
  /** Getting into position and switching sides. */
  transitionSeconds: number;
  /** exercise + rest + transitions. Excludes tutorials and the warm-up. */
  totalSeconds: number;
  /** Extra time if every exercise's tutorial plays once. */
  tutorialSeconds: number;
  /** Exercises counted in reps whose pace isn't known (the fallback pace was used). */
  missingPace: string[];
}

function moveSeconds(
  move: WorkoutMove,
  exercise: EstimateExercise | undefined,
  opts: EstimateOptions,
  missing: Set<string>,
): { work: number; transition: number; rest: number } {
  const sides = exercise?.sided ? 2 : 1;
  let perSide = move.amount;
  if (move.measure === "reps") {
    const pace = exercise?.paceSeconds;
    if (!pace) missing.add(move.exerciseId);
    perSide = move.amount * (pace || opts.fallbackPaceSeconds);
  }
  return {
    work: perSide * sides,
    transition: opts.secondsPerSet + (sides === 2 ? opts.secondsPerSideSwitch : 0),
    rest: sides === 2 ? sideRest(move) : 0,
  };
}

/** A sided move's rest between its sides, in seconds (0 for none). */
function sideRest(move: WorkoutMove): number {
  return Math.max(0, move.restBetweenSides ?? 0);
}

/**
 * Estimate a workout's length. Rests are the rest blocks, the rest between a
 * single exercise's sets (none after the last set), a group's rests, and the
 * rest between a sided exercise's sides.
 */
export function estimateWorkout(
  blocks: WorkoutBlock[],
  exercises: Record<string, EstimateExercise>,
  options: Partial<EstimateOptions> = {},
): WorkoutEstimate {
  const opts = { ...DEFAULT_ESTIMATE_OPTIONS, ...options };
  const missing = new Set<string>();
  const used = new Set<string>();
  let exerciseSeconds = 0;
  let restSeconds = 0;
  let transitionSeconds = 0;

  for (const block of blocks) {
    if (block.kind === "rest") {
      restSeconds += block.seconds;
    } else if (block.kind === "exercise") {
      used.add(block.move.exerciseId);
      const { work, transition, rest } = moveSeconds(block.move, exercises[block.move.exerciseId], opts, missing);
      exerciseSeconds += work * block.sets;
      transitionSeconds += transition * block.sets;
      restSeconds += block.restBetweenSets * (block.sets - 1) + rest * block.sets;
    } else if (block.moves.length > 0) {
      for (const move of block.moves) {
        used.add(move.exerciseId);
        const { work, transition, rest } = moveSeconds(move, exercises[move.exerciseId], opts, missing);
        exerciseSeconds += work * block.rounds;
        transitionSeconds += transition * block.rounds;
        restSeconds += rest * block.rounds;
      }
      restSeconds += block.restBetweenExercises * (block.moves.length - 1) * block.rounds;
      restSeconds += block.restBetweenRounds * (block.rounds - 1);
    }
  }

  let tutorialSeconds = 0;
  for (const id of used) tutorialSeconds += exercises[id]?.tutorialSeconds ?? 0;

  return {
    exerciseSeconds,
    restSeconds,
    transitionSeconds,
    totalSeconds: exerciseSeconds + restSeconds + transitionSeconds,
    tutorialSeconds,
    missingPace: [...missing],
  };
}

/** What members see: "About N min" (never less than 1). */
export function aboutMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Labels for group blocks, numbered per type in order: two exercises make a
 * "Superset", three or more a "Circuit". Non-group blocks get null.
 */
export function groupLabels(blocks: WorkoutBlock[]): (string | null)[] {
  let supersets = 0;
  let circuits = 0;
  return blocks.map((b) => {
    if (b.kind !== "group") return null;
    if (b.moves.length >= 3) return `Circuit ${++circuits}`;
    if (b.moves.length === 2) return `Superset ${++supersets}`;
    return "Superset or circuit";
  });
}

// ── Playing a workout ─────────────────────────────────

/**
 * One screen of the player: a set of an exercise (one side of it, for a sided
 * exercise) or a rest. The player walks the list in order.
 */
export type WorkoutStep = SetStep | RestStep;

/**
 * Where a step's audio tip is kept: in block `block` — on its move number
 * `move` for a set (0 for a single exercise), on the block itself for a rest
 * (`move` null) — under `key` (see TipMap).
 */
export interface TipSlot {
  block: number;
  move: number | null;
  key: string;
}

export interface SetStep {
  kind: "set";
  /** Index of the block it belongs to. */
  block: number;
  exerciseId: string;
  measure: Measure;
  /** Reps or seconds, for this side. */
  amount: number;
  /** The side, for an exercise done on each side; null otherwise. */
  side: Side | null;
  /** Set number (single exercise) or round (group), from 1. */
  round: number;
  /** Sets (single exercise) or rounds (group). */
  rounds: number;
  /** Position in its group; 0 for a single exercise. */
  move: number;
  /** "Superset 1" / "Circuit 1"; null for a single exercise. */
  groupLabel: string | null;
  /**
   * Which set of the workout this is, from 0. Both sides of a sided set share
   * it: it's what the progress bar and "sets done" count.
   */
  setIndex: number;
  /** 0 for the first (or only) side, 1 for the second. */
  part: number;
  parts: 1 | 2;
  /** The exercise's first appearance in the workout — where its tutorial plays. */
  firstOfExercise: boolean;
  /** Estimated length, including getting into position or switching sides. */
  seconds: number;
  /**
   * Just the work: the reps at the clip's pace, or the hold — without getting
   * into position. What an auto-advancing rep set counts down, since the
   * player's get-ready countdown covers getting into position.
   */
  workSeconds: number;
  /** The instructor's audio tip for this set (this side of it), if one was recorded. */
  tip: AudioTip | null;
  tipSlot: TipSlot;
}

export interface RestStep {
  kind: "rest";
  block: number;
  /**
   * What it sits between: a single exercise's sets ("set"), a group's
   * exercises ("exercise") or rounds ("round"), a sided exercise's two sides
   * ("side"), or a rest block ("block").
   */
  reason: "set" | "exercise" | "round" | "side" | "block";
  seconds: number;
  /** The instructor's audio tip for this rest, if one was recorded. */
  tip: AudioTip | null;
  tipSlot: TipSlot;
}

export function otherSide(side: Side): Side {
  return side === "right" ? "left" : "right";
}

/**
 * The workout as the player walks it. Each step's `seconds` follows the same
 * rules as `estimateWorkout`, so they add up to its total — except that rests
 * with nothing to rest before (at the very start or end) are dropped, and
 * back-to-back rests merge into one (keeping the first one's tip).
 */
export function workoutSteps(
  blocks: WorkoutBlock[],
  exercises: Record<string, EstimateExercise>,
  options: Partial<EstimateOptions> = {},
): WorkoutStep[] {
  const opts = { ...DEFAULT_ESTIMATE_OPTIONS, ...options };
  const labels = groupLabels(blocks);
  const seen = new Set<string>();
  const out: WorkoutStep[] = [];
  let setIndex = 0;

  const rest = (block: number, reason: RestStep["reason"], seconds: number, key: string) => {
    if (seconds <= 0 || out.length === 0) return;
    const prev = out[out.length - 1];
    if (prev.kind === "rest") prev.seconds += seconds;
    else {
      const tip = blocks[block].restTips?.[key] ?? null;
      out.push({ kind: "rest", block, reason, seconds, tip, tipSlot: { block, move: null, key } });
    }
  };

  const set = (block: number, move: WorkoutMove, round: number, rounds: number, index: number) => {
    const exercise = exercises[move.exerciseId];
    const sides: Array<Side | null> = exercise?.sided ? [move.firstSide, otherSide(move.firstSide)] : [null];
    const perSide =
      move.measure === "time" ? move.amount : move.amount * (exercise?.paceSeconds || opts.fallbackPaceSeconds);
    sides.forEach((side, part) => {
      if (part === 1) rest(block, "side", sideRest(move), `${round}:${index}:side`);
      const key = side ? `${round}:${side}` : String(round);
      out.push({
        kind: "set",
        block,
        exerciseId: move.exerciseId,
        measure: move.measure,
        amount: move.amount,
        side,
        round,
        rounds,
        move: index,
        groupLabel: labels[block],
        setIndex,
        part,
        parts: sides.length as 1 | 2,
        firstOfExercise: part === 0 && !seen.has(move.exerciseId),
        seconds: perSide + (part === 0 ? opts.secondsPerSet : opts.secondsPerSideSwitch),
        workSeconds: perSide,
        tip: move.tips?.[key] ?? null,
        tipSlot: { block, move: index, key },
      });
    });
    seen.add(move.exerciseId);
    setIndex++;
  };

  blocks.forEach((b, i) => {
    if (b.kind === "rest") {
      rest(i, "block", b.seconds, "rest");
    } else if (b.kind === "exercise") {
      for (let s = 1; s <= b.sets; s++) {
        if (s > 1) rest(i, "set", b.restBetweenSets, String(s));
        set(i, b.move, s, b.sets, 0);
      }
    } else if (b.moves.length > 0) {
      for (let r = 1; r <= b.rounds; r++) {
        if (r > 1) rest(i, "round", b.restBetweenRounds, `${r}:0`);
        b.moves.forEach((m, k) => {
          if (k > 0) rest(i, "exercise", b.restBetweenExercises, `${r}:${k}`);
          set(i, m, r, b.rounds, k);
        });
      }
    }
  });

  while (out.length && out[out.length - 1].kind === "rest") out.pop();
  return out;
}

/** Estimated seconds left from step `index` (inclusive) to the end. */
export function secondsLeft(steps: WorkoutStep[], index: number): number {
  let total = 0;
  for (let i = Math.max(0, index); i < steps.length; i++) total += steps[i].seconds;
  return total;
}

// ── Audio tips ────────────────────────────────────────

/** Put `tip` (or, with null, nothing) in `slot`. Any other fields on the blocks (the builder's keys) are kept. */
export function withTip<B extends WorkoutBlock>(blocks: B[], slot: TipSlot, tip: AudioTip | null): B[] {
  const put = (tips: TipMap | undefined): TipMap => {
    const next = { ...tips };
    if (tip) next[slot.key] = tip;
    else delete next[slot.key];
    return next;
  };
  return blocks.map((b, i): B => {
    if (i !== slot.block) return b;
    if (slot.move === null) return { ...b, restTips: put(b.restTips) };
    if (b.kind === "exercise") return { ...b, move: { ...b.move, tips: put(b.move.tips) } };
    if (b.kind === "group") {
      return { ...b, moves: b.moves.map((m, k) => (k === slot.move ? { ...m, tips: put(m.tips) } : m)) };
    }
    return b;
  });
}

/**
 * The blocks with only the tips their steps play: a tip left behind when its
 * set, side or rest went away (fewer sets, a rest set to 0) is dropped.
 */
export function keepStepTips<B extends WorkoutBlock>(blocks: B[], steps: WorkoutStep[]): B[] {
  const used = new Set(steps.map((s) => `${s.tipSlot.block}/${s.tipSlot.move ?? "-"}/${s.tipSlot.key}`));
  const keep = (tips: TipMap | undefined, block: number, move: number | null): TipMap | undefined => {
    if (!tips) return undefined;
    const kept = Object.entries(tips).filter(([key]) => used.has(`${block}/${move ?? "-"}/${key}`));
    return kept.length ? Object.fromEntries(kept) : undefined;
  };
  return blocks.map((b, i): B => {
    const restTips = keep(b.restTips, i, null);
    if (b.kind === "exercise") return { ...b, restTips, move: { ...b.move, tips: keep(b.move.tips, i, 0) } };
    if (b.kind === "group") return { ...b, restTips, moves: b.moves.map((m, k) => ({ ...m, tips: keep(m.tips, i, k) })) };
    return { ...b, restTips };
  });
}

/** Every tip the blocks hold. */
export function allTips(blocks: WorkoutBlock[]): AudioTip[] {
  const out: AudioTip[] = [];
  for (const b of blocks) {
    out.push(...Object.values(b.restTips ?? {}));
    if (b.kind === "exercise") out.push(...Object.values(b.move.tips ?? {}));
    if (b.kind === "group") b.moves.forEach((m) => out.push(...Object.values(m.tips ?? {})));
  }
  return out;
}
