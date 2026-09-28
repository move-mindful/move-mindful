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
 * One exercise as done in a workout. `amount` is reps or seconds — per side
 * for an exercise done on each side.
 */
export interface WorkoutMove {
  exerciseId: string;
  measure: Measure;
  amount: number;
  /** Sided exercises only. */
  firstSide: Side;
}

export type WorkoutBlock =
  /** A single exercise, done for `sets` sets with `restBetweenSets` between them. */
  | { kind: "exercise"; move: WorkoutMove; sets: number; restBetweenSets: number }
  /** A rest the admin placed between blocks. */
  | { kind: "rest"; seconds: number }
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
  /** Rest blocks plus the rests inside supersets and circuits. */
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
): { work: number; transition: number } {
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
  };
}

/**
 * Estimate a workout's length. Rests are the rest blocks, the rest between a
 * single exercise's sets (none after the last set), and a group's rests.
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
      const { work, transition } = moveSeconds(block.move, exercises[block.move.exerciseId], opts, missing);
      exerciseSeconds += work * block.sets;
      transitionSeconds += transition * block.sets;
      restSeconds += block.restBetweenSets * (block.sets - 1);
    } else if (block.moves.length > 0) {
      for (const move of block.moves) {
        used.add(move.exerciseId);
        const { work, transition } = moveSeconds(move, exercises[move.exerciseId], opts, missing);
        exerciseSeconds += work * block.rounds;
        transitionSeconds += transition * block.rounds;
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
