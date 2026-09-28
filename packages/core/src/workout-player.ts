/**
 * The workout player's state machine: where the member is, what's on screen
 * and when the next thing happens. Pure — the web player (and later the iOS
 * app) keeps the videos and timers in step with it. See plan.md, Phase 4.5.
 *
 * Time comes in on each action as `now` (milliseconds on any steady clock),
 * so the reducer never reads a clock itself and tests can drive it directly.
 */

import type { WorkoutStep } from "./workouts";

/** What plays before each new exercise: its tutorial on repeat, once through, or nothing. */
export type TutorialMode = "loop" | "once" | "off";

/**
 * The tutorial mode that goes with auto-advance: a looping tutorial waits for
 * a tap, so hands-free it plays once instead ("once" and "off" stay as they
 * are). Applied wherever the two meet — on Begin, when either changes, and to
 * saved settings as they load — so Loop and auto-advance are never on together.
 */
export function fitTutorialMode(mode: TutorialMode, autoAdvance: boolean): TutorialMode {
  return autoAdvance && mode === "loop" ? "once" : mode;
}

export type PlayerPhase = "preview" | "warmup" | "workout" | "complete";

/** What's open over the player. "guide" is the first-run gesture guide. */
export type PlayerSheet = "overview" | "settings" | "end" | "guide" | null;

export interface PlayerState {
  phase: PlayerPhase;
  /** The current step (an index into the workout's steps). */
  step: number;
  /** A set shows its exercise's tutorial first, or goes straight to the exercise. */
  stage: "tutorial" | "exercise";
  /** How the tutorial on screen ends: when the member taps ("loop"), or on its own ("once"). */
  tutorialPlay: "loop" | "once";
  mode: TutorialMode;
  paused: boolean;
  sheet: PlayerSheet;
  /**
   * The countdown for a timed set or a rest: `leftMs` as of `since`, or frozen
   * at `leftMs` while `since` is null (paused, or a sheet is open).
   */
  timer: { leftMs: number; since: number | null } | null;
  /** Exercises whose tutorial has come up already, so it doesn't again. */
  seen: string[];
  /** Workout time so far, pauses and the warm-up excluded: `activeMs` plus the time since `activeSince`. */
  activeMs: number;
  activeSince: number | null;
  /** Bumped whenever a clip should start from the beginning (a new step, a restart). */
  take: number;
  /** Show the gesture guide as the first exercise comes up (after any warm-up). */
  guidePending: boolean;
  /**
   * Rep sets move on by themselves after their estimated time (the step's
   * `seconds`: reps at the clip's pace, plus getting into position).
   */
  autoAdvance: boolean;
}

export type PlayerAction =
  /** `guide`: open the gesture guide when the first exercise comes up (a first-time member). */
  | { type: "begin"; warmup: boolean; mode: TutorialMode; guide?: boolean; autoAdvance?: boolean; now: number }
  /** The warm-up finished or was skipped. */
  | { type: "endWarmup"; now: number }
  | { type: "next"; now: number }
  | { type: "back"; now: number }
  /** Check the countdown; moves on once it has run out. */
  | { type: "tick"; now: number }
  /** The clip on screen reached its end: the warm-up, or a tutorial playing once. */
  | { type: "clipEnded"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "sheet"; sheet: PlayerSheet; now: number }
  | { type: "mode"; mode: TutorialMode; now: number }
  /** Turn auto-advance on or off; applies to the set on screen too. */
  | { type: "autoAdvance"; on: boolean; now: number }
  | { type: "restartSet"; now: number }
  | { type: "restartWorkout"; now: number }
  | { type: "watchTutorial"; now: number }
  | { type: "jump"; step: number; now: number }
  /** End the workout: back to the preview, as if it hadn't started. */
  | { type: "exit"; now: number };

export interface PlayerContext {
  steps: WorkoutStep[];
  /** Whether an exercise has a tutorial to show. */
  hasTutorial: (exerciseId: string) => boolean;
}

export const initialPlayerState: PlayerState = {
  phase: "preview",
  step: 0,
  stage: "exercise",
  tutorialPlay: "loop",
  mode: "loop",
  paused: false,
  sheet: null,
  timer: null,
  seen: [],
  activeMs: 0,
  activeSince: null,
  take: 0,
  guidePending: false,
  autoAdvance: false,
};

/** Playing right now: not paused, no sheet over it, and past the preview. */
export function isRunning(s: PlayerState): boolean {
  return (s.phase === "warmup" || s.phase === "workout") && !s.paused && s.sheet === null;
}

/** Milliseconds left on the countdown at `now`, or null when there isn't one. */
export function timerLeft(s: PlayerState, now: number): number | null {
  if (!s.timer) return null;
  const left = s.timer.since === null ? s.timer.leftMs : s.timer.leftMs - (now - s.timer.since);
  return Math.max(0, left);
}

/** Workout time so far at `now`. */
export function activeTime(s: PlayerState, now: number): number {
  return s.activeMs + (s.activeSince === null ? 0 : now - s.activeSince);
}

/**
 * The set a step belongs to for "restart this set" and "watch the tutorial":
 * itself for a set, the set after it for a rest.
 */
export function setStepFor(steps: WorkoutStep[], index: number): number | null {
  for (let i = index; i < steps.length; i++) if (steps[i].kind === "set") return i;
  return null;
}

function timerFor(step: WorkoutStep, stage: PlayerState["stage"], autoAdvance: boolean): PlayerState["timer"] {
  if (step.kind === "rest") return { leftMs: step.seconds * 1000, since: null };
  if (stage !== "exercise") return null;
  if (step.measure === "time") return { leftMs: step.amount * 1000, since: null };
  // Reps, with auto-advance: the set's estimated length.
  return autoAdvance ? { leftMs: step.seconds * 1000, since: null } : null;
}

/** Start the countdown and the workout clock while running; freeze them otherwise. */
function settle(s: PlayerState, now: number): PlayerState {
  const running = isRunning(s);
  let timer = s.timer;
  if (timer && running && timer.since === null) timer = { leftMs: timer.leftMs, since: now };
  if (timer && !running && timer.since !== null) timer = { leftMs: timer.leftMs - (now - timer.since), since: null };

  const counting = running && s.phase === "workout";
  let { activeMs, activeSince } = s;
  if (counting && activeSince === null) activeSince = now;
  if (!counting && activeSince !== null) {
    activeMs += now - activeSince;
    activeSince = null;
  }
  return { ...s, timer, activeMs, activeSince };
}

/**
 * Go to step `index`. Moving forward onto an exercise's first set shows its
 * tutorial (unless tutorials are off or it has none); going back never does.
 */
function enter(ctx: PlayerContext, s: PlayerState, index: number, forward: boolean): PlayerState {
  // The gesture guide, if it's waiting, opens over the first step (holding the clock).
  const base = { ...s, paused: false, sheet: s.guidePending ? ("guide" as const) : null, guidePending: false, take: s.take + 1 };
  if (index >= ctx.steps.length) return { ...base, phase: "complete", timer: null };
  const step = ctx.steps[index];
  let stage: PlayerState["stage"] = "exercise";
  let seen = s.seen;
  if (
    step.kind === "set" &&
    forward &&
    step.firstOfExercise &&
    s.mode !== "off" &&
    !seen.includes(step.exerciseId) &&
    ctx.hasTutorial(step.exerciseId)
  ) {
    stage = "tutorial";
    seen = [...seen, step.exerciseId];
  }
  return {
    ...base,
    phase: "workout",
    step: index,
    stage,
    tutorialPlay: s.mode === "once" ? "once" : "loop",
    seen,
    timer: timerFor(step, stage, s.autoAdvance),
  };
}

function startExercise(ctx: PlayerContext, s: PlayerState): PlayerState {
  const step = ctx.steps[s.step];
  return { ...s, stage: "exercise", timer: timerFor(step, "exercise", s.autoAdvance), take: s.take + 1 };
}

function reduce(ctx: PlayerContext, s: PlayerState, a: PlayerAction): PlayerState {
  const step = ctx.steps[s.step];
  switch (a.type) {
    case "begin": {
      const started = {
        ...s,
        mode: fitTutorialMode(a.mode, !!a.autoAdvance),
        activeMs: 0,
        activeSince: null,
        seen: [],
        guidePending: !!a.guide,
        autoAdvance: !!a.autoAdvance,
      };
      if (a.warmup) return { ...started, phase: "warmup", paused: false, sheet: null, timer: null, take: s.take + 1 };
      return enter(ctx, started, 0, true);
    }
    case "endWarmup":
      return s.phase === "warmup" ? enter(ctx, s, 0, true) : s;
    case "next":
      if (s.phase === "warmup") return enter(ctx, s, 0, true);
      if (s.phase !== "workout") return s;
      if (step?.kind === "set" && s.stage === "tutorial") return startExercise(ctx, s);
      return enter(ctx, s, s.step + 1, true);
    case "back": {
      if (s.phase !== "workout") return s;
      let i = s.step - 1;
      while (i >= 0 && ctx.steps[i].kind === "rest") i--;
      // Nothing before it: start this set again.
      return enter(ctx, s, i >= 0 ? i : s.step, false);
    }
    case "tick": {
      if (!isRunning(s) || s.phase !== "workout" || !s.timer) return s;
      return timerLeft(s, a.now)! <= 0 ? enter(ctx, s, s.step + 1, true) : s;
    }
    case "clipEnded":
      if (s.phase === "warmup") return enter(ctx, s, 0, true);
      return s.phase === "workout" && s.stage === "tutorial" && s.tutorialPlay === "once" ? startExercise(ctx, s) : s;
    case "pause":
      return s.phase === "warmup" || s.phase === "workout" ? { ...s, paused: true } : s;
    case "resume":
      return { ...s, paused: false, sheet: null };
    case "sheet":
      return { ...s, sheet: a.sheet };
    case "autoAdvance": {
      const mode = fitTutorialMode(s.mode, a.on);
      const next = {
        ...s,
        autoAdvance: a.on,
        mode,
        // A looping tutorial on screen plays out once instead.
        tutorialPlay: s.stage === "tutorial" && mode !== "off" ? mode : s.tutorialPlay,
      };
      // A rep set on screen picks it up (a fresh countdown) or drops it.
      if (s.phase === "workout" && step?.kind === "set" && s.stage === "exercise" && step.measure === "reps") {
        return { ...next, timer: timerFor(step, "exercise", a.on) };
      }
      return next;
    }
    case "mode": {
      // A tutorial on screen switches to the new setting too ("off" leaves it
      // up until Begin).
      const mode = fitTutorialMode(a.mode, s.autoAdvance);
      return {
        ...s,
        mode,
        tutorialPlay: s.stage === "tutorial" && mode !== "off" ? mode : s.tutorialPlay,
      };
    }
    case "restartSet": {
      const i = setStepFor(ctx.steps, s.step);
      return s.phase === "workout" && i !== null ? enter(ctx, s, i, false) : s;
    }
    case "restartWorkout":
      // A fresh start: tutorials come up again before each exercise (per the
      // member's setting), and the clock starts over.
      return enter(ctx, { ...s, activeMs: 0, activeSince: null, seen: [] }, 0, true);
    case "watchTutorial": {
      const i = setStepFor(ctx.steps, s.step);
      if (s.phase !== "workout" || i === null) return s;
      const target = ctx.steps[i];
      if (target.kind !== "set" || !ctx.hasTutorial(target.exerciseId)) return s;
      return {
        ...s,
        step: i,
        stage: "tutorial",
        // Follows the setting: Play once plays it through and carries on;
        // Loop (and Off — they asked to see it) waits for a tap.
        tutorialPlay: s.mode === "once" ? "once" : "loop",
        paused: false,
        sheet: null,
        timer: null,
        take: s.take + 1,
      };
    }
    case "jump":
      return s.phase === "workout" && a.step >= 0 && a.step < ctx.steps.length
        ? enter(ctx, s, a.step, a.step > s.step)
        : s;
    case "exit":
      return { ...initialPlayerState, mode: s.mode, autoAdvance: s.autoAdvance, take: s.take + 1 };
  }
}

/** The reducer, bound to one workout. */
export function playerReducer(ctx: PlayerContext) {
  return (s: PlayerState, a: PlayerAction): PlayerState => {
    // Freeze the countdown and clock as they stood before anything changes,
    // then restart them if the new state is running.
    const before = settle({ ...s, paused: true }, a.now);
    const frozen = { ...before, paused: s.paused };
    return settle(reduce(ctx, frozen, a), a.now);
  };
}
