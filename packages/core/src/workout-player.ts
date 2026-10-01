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

/**
 * Where the member is, in order: the preview, the workout's intro video (if
 * it has one), the warm-up (if taken), the exercises, then — when it has a
 * cool-down — "Cool down?", the cool-down if they say yes, the outro video
 * (if it has one) and the summary.
 */
export type PlayerPhase =
  | "preview"
  | "intro"
  | "warmup"
  | "workout"
  | "cooldownPrompt"
  | "cooldown"
  | "outro"
  | "complete";

/** The phases that are one video, played start to finish: skippable, no sets or timers. */
export type VideoPhase = "intro" | "warmup" | "cooldown" | "outro";

export function isVideoPhase(phase: PlayerPhase): phase is VideoPhase {
  return phase === "intro" || phase === "warmup" || phase === "cooldown" || phase === "outro";
}

/**
 * The exercises are done: what comes after them (the cool-down question, the
 * cool-down, the outro) or the summary. The workout counts as finished here.
 */
export function isFinished(phase: PlayerPhase): boolean {
  return phase === "cooldownPrompt" || phase === "cooldown" || phase === "outro" || phase === "complete";
}

/**
 * What's open over the player. "guide" is the first-run gesture guide;
 * "restartVideo" asks whether to start the video on screen over — the intro,
 * warm-up, cool-down or outro (a tap on its left).
 */
export type PlayerSheet = "overview" | "settings" | "audio" | "end" | "guide" | "restartVideo" | null;

export interface PlayerState {
  phase: PlayerPhase;
  /** The current step (an index into the workout's steps). */
  step: number;
  /**
   * Where a set is: its exercise's tutorial, the get-ready countdown before
   * the exercise (see `readyMs`), or the exercise itself.
   */
  stage: "tutorial" | "ready" | "exercise";
  /** How the tutorial on screen ends: when the member taps ("loop"), or on its own ("once"). */
  tutorialPlay: "loop" | "once";
  mode: TutorialMode;
  paused: boolean;
  sheet: PlayerSheet;
  /**
   * The countdown for a timed set, a rest or getting ready: `leftMs` as of
   * `since`, or frozen at `leftMs` while `since` is null (paused, or a sheet
   * is open).
   */
  timer: { leftMs: number; since: number | null } | null;
  /** Exercises whose tutorial has come up already, so it doesn't again. */
  seen: string[];
  /** Workout time so far, pauses and the warm-up excluded: `activeMs` plus the time since `activeSince`. */
  activeMs: number;
  activeSince: number | null;
  /** Bumped whenever a clip should start from the beginning (a new step, a restart). */
  take: number;
  /** Show the gesture guide as the first exercise comes up (a workout begun without an intro or warm-up, or resumed). */
  guidePending: boolean;
  /** Begun with the warm-up: going back from the first exercise returns to it. */
  withWarmup: boolean;
  /**
   * Rep sets move on by themselves after the time the reps take (the step's
   * `workSeconds`: reps at the clip's pace; getting ready comes before it).
   */
  autoAdvance: boolean;
}

export type PlayerAction =
  /**
   * `guide`: open the gesture guide (a first-time member) — straight away, over
   * the intro or warm-up (held until it closes), or else as the first exercise
   * comes up. The intro plays first whenever the workout has one (see
   * `hasIntro`), except on a resume.
   */
  | {
      type: "begin";
      warmup: boolean;
      mode: TutorialMode;
      guide?: boolean;
      autoAdvance?: boolean;
      /**
       * Resume saved progress: start at this set (see resumeFrom), with the
       * workout time already done. A resume skips the warm-up.
       */
      from?: number;
      activeMs?: number;
      now: number;
    }
  /** The warm-up finished or was skipped. */
  | { type: "endWarmup"; now: number }
  /** The answer to "Cool down?" after the last exercise. */
  | { type: "chooseCooldown"; yes: boolean; now: number }
  /** Straight to the summary from what comes after the exercises (End workout there). */
  | { type: "finish"; now: number }
  | { type: "next"; now: number }
  | { type: "back"; now: number }
  /** Check the countdown; moves on once it has run out. */
  | { type: "tick"; now: number }
  /** The clip on screen reached its end: a video phase's, or a tutorial playing once. */
  | { type: "clipEnded"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "sheet"; sheet: PlayerSheet; now: number }
  | { type: "mode"; mode: TutorialMode; now: number }
  /** Turn auto-advance on or off; applies to the set on screen too. */
  | { type: "autoAdvance"; on: boolean; now: number }
  /** Start the set on screen again — or, during a tutorial, that tutorial ("Restart tutorial"). */
  | { type: "restartSet"; now: number }
  /** Start the video on screen over: the intro, warm-up, cool-down or outro. */
  | { type: "restartVideo"; now: number }
  /** From the top, with the warm-up first when `warmup` (the workout has one and the member's setting is on). */
  | { type: "restartWorkout"; warmup?: boolean; now: number }
  | { type: "watchTutorial"; now: number }
  | { type: "jump"; step: number; now: number }
  /** End the workout: back to the preview, as if it hadn't started. */
  | { type: "exit"; now: number };

export interface PlayerContext {
  steps: WorkoutStep[];
  /** Whether an exercise has a tutorial to show. */
  hasTutorial: (exerciseId: string) => boolean;
  /**
   * A "get ready" countdown this long before a set's exercise starts (none
   * when absent or 0): after a tutorial, and whenever a set comes up without
   * a rest counting down into it — the start, after the warm-up, between
   * exercises or sides, going back, resuming. After a rest it's skipped: the
   * rest was the countdown.
   */
  readyMs?: number;
  /** The workout has an intro video: it plays first on Begin (not on a resume or a restart). */
  hasIntro?: boolean;
  /** The workout has a cool-down: "Cool down?" comes after the last exercise. */
  hasCooldown?: boolean;
  /** The workout has an outro video: it plays after the exercises (and the cool-down), before the summary. */
  hasOutro?: boolean;
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
  withWarmup: false,
  autoAdvance: false,
};

/** Playing right now: a video or the exercises, not paused, no sheet over it. */
export function isRunning(s: PlayerState): boolean {
  return (isVideoPhase(s.phase) || s.phase === "workout") && !s.paused && s.sheet === null;
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
  return autoAdvance ? { leftMs: step.workSeconds * 1000, since: null } : null;
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

/** The get-ready countdown, fresh. */
function readyTimer(ctx: PlayerContext): PlayerState["timer"] {
  return { leftMs: ctx.readyMs ?? 0, since: null };
}

/**
 * Go to step `index`. Moving forward onto an exercise's first set shows its
 * tutorial (unless tutorials are off or it has none); going back never does.
 * Otherwise a set gets ready first — unless a rest has just counted down into
 * another set of the same exercise (see `readyMs`). A rest into a different
 * exercise still gets ready, so the member sees what's coming.
 */
function enter(ctx: PlayerContext, s: PlayerState, index: number, forward: boolean): PlayerState {
  // The gesture guide, if it's waiting, opens over the first step (holding the clock).
  const base = { ...s, paused: false, sheet: s.guidePending ? ("guide" as const) : null, guidePending: false, take: s.take + 1 };
  if (index >= ctx.steps.length) return afterWorkout(ctx, { ...base, timer: null });
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
  const afterRest = forward && s.phase === "workout" && ctx.steps[s.step]?.kind === "rest" && index === s.step + 1;
  if (stage === "exercise" && step.kind === "set" && ctx.readyMs && !(afterRest && sameAsBefore(ctx.steps, index))) {
    stage = "ready";
  }
  return {
    ...base,
    phase: "workout",
    step: index,
    stage,
    tutorialPlay: s.mode === "once" ? "once" : "loop",
    seen,
    timer: stage === "ready" ? readyTimer(ctx) : timerFor(step, stage, s.autoAdvance),
  };
}

/** Whether the set at `index` is the same exercise as the last set before it (across any rest). */
function sameAsBefore(steps: WorkoutStep[], index: number): boolean {
  const step = steps[index];
  for (let i = index - 1; i >= 0; i--) {
    const before = steps[i];
    if (before.kind === "set") return step.kind === "set" && before.exerciseId === step.exerciseId;
  }
  return false;
}

/** Play a video phase from its start. */
function playVideo(s: PlayerState, phase: VideoPhase): PlayerState {
  return { ...s, phase, paused: false, sheet: null, timer: null, take: s.take + 1 };
}

/** The warm-up from the top. */
function playWarmup(s: PlayerState): PlayerState {
  return { ...playVideo(s, "warmup"), step: 0, stage: "exercise" };
}

/** The intro done with: the warm-up if they're taking it, else the first exercise. */
function afterIntro(ctx: PlayerContext, s: PlayerState): PlayerState {
  return s.withWarmup ? playWarmup(s) : enter(ctx, s, 0, true);
}

/** The last exercise done: "Cool down?" when there's a cool-down, otherwise on past it. */
function afterWorkout(ctx: PlayerContext, s: PlayerState): PlayerState {
  if (ctx.hasCooldown) return { ...s, phase: "cooldownPrompt", paused: false, timer: null };
  return afterCooldown(ctx, s);
}

/** The cool-down done with (taken or not): the outro, if there is one, then the summary. */
function afterCooldown(ctx: PlayerContext, s: PlayerState): PlayerState {
  return ctx.hasOutro ? playVideo(s, "outro") : finish(s);
}

function finish(s: PlayerState): PlayerState {
  return { ...s, phase: "complete", paused: false, sheet: null, timer: null, take: s.take + 1 };
}

/** A video phase's clip finished, or was skipped: on to what follows it. */
function afterVideo(ctx: PlayerContext, s: PlayerState): PlayerState {
  switch (s.phase) {
    case "intro":
      return afterIntro(ctx, s);
    case "warmup":
      return enter(ctx, s, 0, true);
    case "cooldown":
      return afterCooldown(ctx, s);
    case "outro":
      return finish(s);
    default:
      return s;
  }
}

function startExercise(ctx: PlayerContext, s: PlayerState): PlayerState {
  const step = ctx.steps[s.step];
  return { ...s, stage: "exercise", timer: timerFor(step, "exercise", s.autoAdvance), take: s.take + 1 };
}

/** A tutorial done with (played through, or skipped): get ready, then the exercise. */
function afterTutorial(ctx: PlayerContext, s: PlayerState): PlayerState {
  return ctx.readyMs ? { ...s, stage: "ready", timer: readyTimer(ctx), take: s.take + 1 } : startExercise(ctx, s);
}

function reduce(ctx: PlayerContext, s: PlayerState, a: PlayerAction): PlayerState {
  const step = ctx.steps[s.step];
  switch (a.type) {
    case "begin": {
      const from = a.from ? (setStepFor(ctx.steps, a.from) ?? 0) : 0;
      const started = {
        ...s,
        mode: fitTutorialMode(a.mode, !!a.autoAdvance),
        activeMs: from ? Math.max(0, a.activeMs ?? 0) : 0,
        activeSince: null,
        // Resuming, the exercises already done don't show their tutorials again.
        seen: [...new Set(ctx.steps.slice(0, from).flatMap((st) => (st.kind === "set" ? [st.exerciseId] : [])))],
        guidePending: !!a.guide,
        autoAdvance: !!a.autoAdvance,
        withWarmup: a.warmup && !from,
      };
      // The guide, if it's due, comes first: learned (and settings chosen)
      // before the intro or warm-up, not after it with the member already warm.
      const sheet = a.guide ? ("guide" as const) : null;
      if (ctx.hasIntro && !from) return { ...playVideo(started, "intro"), step: 0, stage: "exercise", sheet, guidePending: false };
      if (a.warmup && !from) return { ...playWarmup(started), sheet, guidePending: false };
      return enter(ctx, started, from, true);
    }
    case "endWarmup":
      return s.phase === "warmup" ? enter(ctx, s, 0, true) : s;
    case "chooseCooldown":
      if (s.phase !== "cooldownPrompt") return s;
      return a.yes ? playVideo(s, "cooldown") : afterCooldown(ctx, s);
    case "finish":
      return isFinished(s.phase) && s.phase !== "complete" ? finish(s) : s;
    case "next":
      // A video: skip it.
      if (isVideoPhase(s.phase)) return afterVideo(ctx, s);
      if (s.phase !== "workout") return s;
      if (step?.kind === "set" && s.stage === "tutorial") return afterTutorial(ctx, s);
      // "Start now" while getting ready.
      if (step?.kind === "set" && s.stage === "ready") return startExercise(ctx, s);
      return enter(ctx, s, s.step + 1, true);
    case "back": {
      if (s.phase !== "workout") return s;
      let i = s.step - 1;
      while (i >= 0 && ctx.steps[i].kind === "rest") i--;
      // Nothing before it: back to the warm-up from the top, if the workout
      // began with it; otherwise start this set again.
      if (i < 0 && s.withWarmup) return playWarmup(s);
      return enter(ctx, s, i >= 0 ? i : s.step, false);
    }
    case "tick": {
      if (!isRunning(s) || s.phase !== "workout" || !s.timer) return s;
      if (timerLeft(s, a.now)! > 0) return s;
      // Ready: the exercise starts. Otherwise the set or rest is over.
      return s.stage === "ready" ? startExercise(ctx, s) : enter(ctx, s, s.step + 1, true);
    }
    case "clipEnded":
      if (isVideoPhase(s.phase)) return afterVideo(ctx, s);
      return s.phase === "workout" && s.stage === "tutorial" && s.tutorialPlay === "once" ? afterTutorial(ctx, s) : s;
    case "pause":
      return isVideoPhase(s.phase) || s.phase === "workout" ? { ...s, paused: true } : s;
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
      if (s.phase !== "workout" || i === null) return s;
      // A tutorial on screen plays again from its start.
      if (s.stage === "tutorial" && i === s.step) {
        return { ...s, paused: false, sheet: null, timer: null, take: s.take + 1 };
      }
      return enter(ctx, s, i, false);
    }
    case "restartVideo":
      return isVideoPhase(s.phase) ? { ...s, paused: false, sheet: null, take: s.take + 1 } : s;
    case "restartWorkout": {
      // A fresh start: the warm-up first when it's on, tutorials again before
      // each exercise (per the member's setting), and the clock from zero. The
      // intro isn't replayed — they've just heard it.
      const fresh = { ...s, activeMs: 0, activeSince: null, seen: [], withWarmup: !!a.warmup };
      return a.warmup ? playWarmup(fresh) : enter(ctx, fresh, 0, true);
    }
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
      if (a.step < 0 || a.step >= ctx.steps.length) return s;
      // From the warm-up (its overview): on to that step, as if the warm-up had ended there.
      if (s.phase === "warmup") return enter(ctx, s, a.step, true);
      return s.phase === "workout" ? enter(ctx, s, a.step, a.step > s.step) : s;
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
