"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  aboutMinutes,
  activeTime,
  estimateWorkout,
  fitTutorialMode,
  initialPlayerState,
  isFinished,
  isRunning,
  isVideoPhase,
  playerReducer,
  resumeFrom,
  secondsLeft,
  sequenceKey,
  setStepFor,
  workoutProgress,
  workoutSteps,
  type PlayerAction,
  type SetStep,
  type VideoPhase,
  type WorkoutStep,
} from "@move-mindful/core";
import { levelsLabel } from "@/lib/exercises/shared";
import { amountLabel, clock, equipmentText, loopFor, type PlayerClip, type PlayerWorkout } from "@/lib/workouts/player";
import { rateWorkout } from "@/app/actions/workout-ratings";
import { OverviewSheet } from "./overview-sheet";
import { ProgressBar } from "./progress-bar";
import {
  CompleteScreen,
  CooldownPrompt,
  Dim,
  EndSheet,
  PausedScreen,
  ReadyScreen,
  RestartVideoPrompt,
  RestScreen,
  SetScreen,
  TopShade,
  LoadingSpinner,
  TapZones,
  TopBar,
  CornerSettings,
  CornerAudio,
  TutorialScreen,
  SettingsSheet,
  AudioSheet,
  VideoProgress,
  createSheetPull,
  VideoScreen,
} from "./player-screens";
import { List, Moon, Muted, Pause, Play, Settings, Sound, Sun } from "./icons";
import {
  Dimmed,
  TheaterArrows,
  TheaterButtons,
  TheaterSetInfo,
  TheaterTutorialInfo,
  TheaterVideoInfo,
  useTheater,
  type TheaterButton,
} from "./theater";
import { POOL_SIZE, PoolVideos, useVideoPool, type PoolClip, type ShownClip } from "./video-pool";
import { WorkoutPreview } from "./workout-preview";
import { GestureGuide } from "./gesture-guide";
import { DesktopGuide } from "./desktop-guide";
import { usePlayerPreferences } from "./preferences";
import { CoachTip } from "./coach-tip";
import { COUNTDOWN, useCueAudio } from "./cue-audio";
import { MUSIC, useWorkoutMusic } from "./music";
import { TIP_DELAY_SECONDS, tipUrl } from "@/lib/workouts/shared";
import { saveWorkoutSession } from "@/app/actions/workout-sessions";
import type { PlayerPreferences } from "@/lib/member/preferences";
import type { SavedProgress, SessionEvent } from "@/lib/member/sessions";

/**
 * The member's workout: the preview, then the optional warm-up, the workout
 * itself (story-style, one set at a time) and the summary. The state machine is
 * `playerReducer` from @move-mindful/core; this component shows its state,
 * keeps the videos and timers in step with it, and turns taps into actions.
 * Designs: the player design canvas (plan.md, Phase 4.5).
 */

type WithoutNow<T> = T extends unknown ? Omit<T, "now"> : never;

// The Audio Session API (Safari 16.4+, Firefox) lets a page ask to mix its
// sound with other apps' instead of pausing them — what "Keep my music
// playing" uses. Chrome doesn't have it yet, so there the setting is hidden.
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };
const noSubscribe = () => () => {};

/**
 * "Keep my music playing" is hidden for now: user testing plays our own
 * sample music instead (the Audio card's Music). While hidden it's off too —
 * the default "auto" session — so nobody who'd switched it on is left in
 * "ambient" mode with no switch to leave it. Flip to bring it back.
 */
const KEEP_MY_MUSIC = false;

function useCanMixAudio(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => !!(navigator as AudioSessionNavigator).audioSession,
    () => false,
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The get-ready countdown before an exercise starts (see readyMs in core). */
const GET_READY_MS = 6000;

/** A random (v4) UUID — randomUUID is only there on https pages, so build one otherwise. */
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Only tutorials and the videos around the exercises (intro, warm-up,
// cool-down, outro) are heard: an exercise's loop always plays muted, even if
// its file has sound.
function shownOf(clip: PlayerClip | null | undefined, loop: boolean, silent = false): ShownClip | null {
  return clip ? { url: clip.url, poster: clip.poster, loop, silent } : null;
}

// The videos that play once, start to finish, around the exercises: what each
// is called ("Skip the cool-down"…) and its chip's icon.
const VIDEO_TEXT: Record<VideoPhase, { label: string; noun: string; icon: (size: number) => ReactNode }> = {
  intro: { label: "Intro", noun: "intro", icon: () => null },
  warmup: { label: "Warm-up", noun: "warm-up", icon: (size) => <Sun size={size} /> },
  cooldown: { label: "Cool-down", noun: "cool-down", icon: (size) => <Moon size={size} /> },
  outro: { label: "Outro", noun: "outro", icon: () => null },
};

function videoClip(workout: PlayerWorkout, phase: VideoPhase): PlayerClip | null {
  if (phase === "intro") return workout.intro;
  if (phase === "outro") return workout.outro;
  return workout[phase]?.clip ?? null;
}

/** The name under the chip: the workout's own title for its intro and outro. */
function videoName(workout: PlayerWorkout, phase: VideoPhase): string {
  if (phase === "intro" || phase === "outro") return workout.title;
  return workout[phase]?.name ?? VIDEO_TEXT[phase].label;
}

export function WorkoutPlayer({
  workout,
  backHref,
  preferences,
  progress,
  lastDone = null,
  myRating = null,
  signedIn,
  guideEveryTime = false,
}: {
  workout: PlayerWorkout;
  backHref: string;
  /** The member's saved settings (null when signed out) — see usePlayerPreferences. */
  preferences: Partial<PlayerPreferences> | null;
  /** Where the member left off in this workout, if they saved it (null signed out). */
  progress: SavedProgress | null;
  /** When the member last finished this workout (null if never, or signed out). */
  lastDone?: string | null;
  /** The member's own rating of this workout, 1–5 (null if they haven't, or signed out). */
  myRating?: number | null;
  signedIn: boolean;
  /** Show the gesture guide on every Begin, not just a member's first (signed-out /demo1 visitors). */
  guideEveryTime?: boolean;
}) {

  const estimates = useMemo(
    () => Object.fromEntries(Object.values(workout.exercises).map((e) => [e.id, e.estimate])),
    [workout.exercises],
  );
  const steps = useMemo(() => workoutSteps(workout.blocks, estimates), [workout.blocks, estimates]);
  const totalSeconds = useMemo(() => estimateWorkout(workout.blocks, estimates).totalSeconds, [workout.blocks, estimates]);
  const setSteps = steps.filter((s): s is SetStep => s.kind === "set");
  const setCount = setSteps.length ? setSteps[setSteps.length - 1].setIndex + 1 : 0;
  const exerciseCount = new Set(setSteps.map((s) => s.exerciseId)).size;
  const key = useMemo(() => sequenceKey(steps), [steps]);

  const reducer = useMemo(
    () =>
      playerReducer({
        steps,
        hasTutorial: (id) => !!workout.exercises[id]?.tutorial,
        readyMs: GET_READY_MS,
        hasIntro: !!workout.intro,
        hasCooldown: !!workout.cooldown,
        hasOutro: !!workout.outro,
      }),
    [steps, workout.exercises, workout.intro, workout.cooldown, workout.outro],
  );
  const [state, dispatch] = useReducer(reducer, initialPlayerState);
  const act = useCallback((a: WithoutNow<PlayerAction>) => dispatch({ ...a, now: performance.now() } as PlayerAction), []);

  const [prefs, updatePrefs] = usePlayerPreferences({ account: preferences, signedIn });
  const canMix = useCanMixAudio() && KEEP_MY_MUSIC;
  const mixAudio = canMix && prefs.mixAudio;

  // Saved progress, offered on the preview as Resume: the page's, then
  // whatever the last End workout left. Only while it still fits the workout
  // (see resumeFrom).
  const [saved, setSaved] = useState(progress);
  const resumeAt = saved ? resumeFrom(steps, saved) : null;

  // Signed in, the workout is saved as it goes (workout_sessions): the session
  // is made when it begins and updated at every new set, so Resume is there
  // even if the page is closed. Saves go one at a time, in order — the first
  // creates the row the rest update.
  const session = useRef<{ id: string; withWarmup: boolean } | null>(null);
  const [doneAt, setDoneAt] = useState<string | null>(lastDone);
  // Their stars for this workout: shown at once, reverted if the save fails.
  const [stars, setStars] = useState<number | null>(myRating);
  async function rate(value: number) {
    const before = stars;
    setStars(value);
    const res = await rateWorkout(workout.id, value).catch(() => ({ saved: false }));
    if (!res.saved) setStars(before);
  }
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  function record(event: SessionEvent, at: number, activeMs = activeTime(state, performance.now())) {
    const current = session.current;
    if (!signedIn || !current) return;
    const save = {
      sessionId: current.id,
      workoutId: workout.id,
      event,
      step: at,
      ...workoutProgress(steps, at),
      activeSeconds: Math.min(86_400, Math.round(activeMs / 1000)),
      sequenceKey: key,
      withWarmup: current.withWarmup,
    };
    saving.current = saving.current.then(() => saveWorkoutSession(save)).catch(() => {
      // Offline or the save failed: the next one carries the latest anyway.
    });
  }
  function startSession(withWarmup: boolean) {
    if (!signedIn) return;
    session.current = { id: newId(), withWarmup };
    record("start", 0, 0);
  }
  const onStep = useEffectEvent(() => {
    if (state.phase === "workout") record("progress", setStepFor(steps, state.step) ?? state.step);
    // Done once the exercises are: the cool-down and outro are extras, so
    // leaving during them still counts.
    if (isFinished(state.phase) && session.current) {
      record("complete", steps.length);
      session.current = null;
      // The preview's "Done" pill, up to date without a reload.
      setDoneAt(new Date().toISOString());
    }
  });
  useEffect(() => {
    onStep();
  }, [state.phase, state.step]);

  // On a phone, the bar around the notch goes black while the player is up —
  // iOS (and Android's browser bar) colours it from the page's theme-color,
  // the player pages' purple — and back to purple on the workout preview. The
  // strip at the bottom comes from the page's background, so it stays purple.
  // Touch screens only: desktop Safari would tint its tab bar too.
  const inPlayer = state.phase !== "preview";
  useEffect(() => {
    if (!inPlayer || !window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
    let metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const added = metas.length === 0;
    if (added) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.append(meta);
      metas = [meta];
    }
    const before = metas.map((m) => m.content);
    metas.forEach((m) => (m.content = "#000000"));
    return () => {
      if (added) metas.forEach((m) => m.remove());
      else metas.forEach((m, i) => (m.content = before[i]));
    };
  }, [inPlayer]);

  // "Keep my music playing": an "ambient" session mixes with other apps'
  // audio (iOS then lets the Silent switch mute it); "auto" is the default,
  // where instructor audio pauses them. Set before anything plays, and put back
  // on the way out.
  useEffect(() => {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (!session) return;
    try {
      session.type = mixAudio ? "ambient" : "auto";
    } catch {
      // An older implementation that rejects the value: leave it be.
    }
    return () => {
      try {
        session.type = "auto";
      } catch {
        // As above.
      }
    };
  }, [mixAudio]);
  const [muted, setMuted] = useState(false);
  const [warmedUp, setWarmedUp] = useState(false);
  // Settings opened from the guide's last page ("Change settings"): closing
  // Settings goes back to that page rather than into the workout.
  const [settingsFromGuide, setSettingsFromGuide] = useState(false);
  // Paused on a rest or get-ready screen: it stays on that screen, its
  // countdown held, rather than switching to the pause screen.
  const [holdInPlace, setHoldInPlace] = useState(false);
  const theater = useTheater();
  // Controls swiped away (phones): just the reps over the video, until a swipe up.
  const [chromeHidden, setChromeHidden] = useState(false);
  // The overview being dragged up by the finger (phones) — see createSheetPull.
  const [pull] = useState(createSheetPull);

  const [buffering, setBuffering] = useState(false);
  const pool = useVideoPool({
    onEnded: () => act({ type: "clipEnded" }),
    onSoundBlocked: () => setMuted(true),
    onBuffering: setBuffering,
  });

  const running = isRunning(state);
  // A countdown screen — a rest, or getting ready — where pausing holds in place.
  const onCountdown =
    state.phase === "workout" && (steps[state.step]?.kind === "rest" || state.stage === "ready");
  function pause() {
    setHoldInPlace(onCountdown);
    act({ type: "pause" });
  }
  function resumePlay() {
    setHoldInPlace(false);
    // A tap: on an iPhone the music may need it to start again.
    wakeMusic();
    act({ type: "resume" });
  }
  /** Back on the intro, warm-up, cool-down or outro (a left tap, the left arrow): ask whether to start it over. */
  function askRestartVideo() {
    act({ type: "sheet", sheet: "restartVideo" });
  }
  // Under way: past the preview, short of the summary.
  const active = state.phase !== "preview" && state.phase !== "complete";
  const step: WorkoutStep | undefined = steps[state.step];
  const set = step?.kind === "set" ? step : null;
  const exercise = set ? workout.exercises[set.exerciseId] : undefined;
  // The set this step is, or — for a rest — the one it leads into.
  const targetIndex = setStepFor(steps, state.step);
  const target = targetIndex !== null ? (steps[targetIndex] as SetStep) : null;
  const targetExercise = target ? workout.exercises[target.exerciseId] : undefined;

  // The instructor's audio tip for the step on screen: a rest's, or a set's
  // once the exercise itself is on (after the tutorial and Get ready). It
  // plays a moment in, with their photo on screen — see useCueAudio.
  const tipStep =
    state.phase === "workout" && step && (step.kind === "rest" || state.stage === "exercise") ? step : null;
  const tips = useCueAudio({
    clip: tipStep?.tip
      ? { url: tipUrl(tipStep.tip.id), start: tipStep.tip.start ?? 0, end: tipStep.tip.end ?? null }
      : null,
    take: state.take,
    running: running && !!tipStep,
    delayMs: (step?.kind === "rest" ? TIP_DELAY_SECONDS.rest : TIP_DELAY_SECONDS.set) * 1000,
    // Mute all, or just the tips switched off in the Audio card.
    muted: muted || !prefs.audioTips,
  });
  const coach = (large = false) => <CoachTip show={tips.playing} instructor={workout.instructor} large={large} />;

  // The countdown over a rest's last seconds: a sound effect, off with the
  // Audio card's Sound effects (or Mute all). Timed to end as the rest does.
  const rest = state.phase === "workout" && step?.kind === "rest" ? step : null;
  const countdownFrom = COUNTDOWN.seconds + COUNTDOWN.lead;
  const countdown = useCueAudio({
    clip: rest ? { url: COUNTDOWN.src, start: Math.max(0, countdownFrom - rest.seconds), end: null } : null,
    take: state.take,
    running: running && !!rest,
    delayMs: rest ? Math.max(0, rest.seconds - countdownFrom) * 1000 : 0,
    muted: muted || !prefs.soundEffects,
  });

  // Music under the workout (the Audio card's Music switch). It plays while the
  // workout runs — the overview and the Audio card leave it going — and on
  // through the summary until Done; it dips under a voice, through the
  // warm-up and cool-down, and on the summary. Held in the workout — paused
  // (a rest or Get ready held right there included), or Settings, End
  // workout or the guide over it — it keeps playing quietly instead of
  // stopping. The levels are in MUSIC.
  const musicHeld =
    state.phase === "workout" &&
    (state.paused || state.sheet === "settings" || state.sheet === "end" || state.sheet === "guide");
  const duckTo = (() => {
    if (musicHeld) return MUSIC.duckTo.paused;
    if (state.phase === "complete") return MUSIC.duckTo.done;
    if (tips.playing) return MUSIC.duckTo.tip;
    if (state.phase === "workout" && step?.kind === "set" && state.stage === "tutorial") return MUSIC.duckTo.tutorial;
    if (state.phase === "intro" || state.phase === "outro" || state.phase === "warmup" || state.phase === "cooldown") {
      return MUSIC.duckTo[state.phase];
    }
    return 100;
  })();
  const music = useWorkoutMusic({
    on: prefs.music && !muted,
    playing:
      musicHeld ||
      ((active || state.phase === "complete") &&
        !state.paused &&
        (state.sheet === null || state.sheet === "overview" || state.sheet === "audio")),
    level: (MUSIC.volume / 100) * (duckTo / 100),
  });
  /** In a tap that should get the music going, if it's meant to be on. */
  function wakeMusic() {
    if (prefs.music && !muted) music.wake();
  }

  // ── Videos ──────────────────────────────────────────

  const shown = useMemo<ShownClip | null>(() => {
    if (state.phase === "preview") return null;
    if (isVideoPhase(state.phase)) return shownOf(videoClip(workout, state.phase), false);
    const st = steps[state.step];
    if (!st) return null;
    // A rest shows the next exercise (blurred); "Cool down?" and the summary, the last one.
    if (st.kind === "rest" || state.phase === "complete" || state.phase === "cooldownPrompt") {
      const i = setStepFor(steps, state.step);
      const s = i !== null ? steps[i] : null;
      return s?.kind === "set" ? shownOf(loopFor(workout.exercises[s.exerciseId], s.side), true, true) : null;
    }
    const e = workout.exercises[st.exerciseId];
    if (state.stage === "tutorial" && e?.tutorial) return shownOf(e.tutorial, state.tutorialPlay === "loop");
    return shownOf(loopFor(e, st.side), true, true);
  }, [state.phase, state.step, state.stage, state.tutorialPlay, steps, workout]);

  // What's on screen, then what comes after it — kept loaded in the pool.
  const upcoming = useMemo<PoolClip[]>(() => {
    const list: PoolClip[] = [];
    const add = (c: { url: string; poster: string } | null | undefined) => {
      if (c && list.length < POOL_SIZE && !list.some((x) => x.url === c.url)) list.push({ url: c.url, poster: c.poster });
    };
    add(shown);
    const p = state.phase;
    if (p === "preview") add(workout.intro);
    if (p === "preview" || p === "intro") add(workout.warmup?.clip);
    const started = p === "workout";
    // After the exercises, only what follows them.
    const ahead = isFinished(p) ? 0 : steps.length;
    for (let i = started ? state.step : 0; i < ahead && list.length < POOL_SIZE; i++) {
      const st = steps[i];
      if (st.kind !== "set") continue;
      const e = workout.exercises[st.exerciseId];
      const tutorial =
        started && i === state.step
          ? state.stage === "tutorial"
          : st.firstOfExercise && state.mode !== "off" && !state.seen.includes(st.exerciseId);
      if (tutorial) add(e?.tutorial);
      add(loopFor(e, st.side));
    }
    if (p !== "cooldown" && p !== "outro" && p !== "complete") add(workout.cooldown?.clip);
    if (p !== "outro" && p !== "complete") add(workout.outro);
    return list;
  }, [shown, state.phase, state.step, state.stage, state.mode, state.seen, steps, workout]);

  // Sheets stop the clock — all but the Audio card, under which everything
  // carries on (see isRunning). The video keeps playing behind the overview (so
  // pulling it up doesn't stutter) — the warm-up's and cool-down's too, sound
  // and all; if one ends meanwhile, what follows comes up as usual, closing the overview —
  // but pauses under
  // Settings and End workout. Getting ready, the exercise already plays behind
  // the blur; it starts over from the top as the countdown ends (a new take),
  // in step with the member.
  const playing =
    running ||
    ((state.phase === "workout" || state.phase === "warmup" || state.phase === "cooldown") &&
      !state.paused &&
      state.sheet === "overview");
  useEffect(() => {
    pool.sync(upcoming, shown, { playing, muted, take: state.take });
  }, [pool, upcoming, shown, playing, muted, state.take]);

  // ── Clocks ──────────────────────────────────────────

  // The countdown for a timed set or a rest: redraw a few times a second, and
  // tell the reducer when it runs out.
  const [now, setNow] = useState(0);
  const timer = state.timer;
  useEffect(() => {
    if (!timer || timer.since === null) return;
    const since = timer.since;
    const id = window.setInterval(() => {
      const t = performance.now();
      setNow(t);
      if (timer.leftMs - (t - since) <= 0) dispatch({ type: "tick", now: t });
    }, 200);
    return () => window.clearInterval(id);
  }, [timer]);
  const leftMs = timer
    ? Math.max(0, Math.min(timer.leftMs, timer.since === null ? timer.leftMs : timer.leftMs - (now - timer.since)))
    : 0;

  // How far a video (the intro, warm-up, cool-down, outro) or a tutorial has got. `cycle` counts a looping
  // tutorial's trips round, so its progress can restart without sliding back.
  const clipTimed = isVideoPhase(state.phase) || (state.phase === "workout" && state.stage === "tutorial");
  const [clipTime, setClipTime] = useState({ take: -1, time: 0, duration: 0, cycle: 0 });
  // A tutorial playing once should end (and start the exercise) on the
  // video's "ended" event; if it ever wraps round to the start instead, treat
  // that as its end too.
  const playsOnce = state.phase === "workout" && state.stage === "tutorial" && state.tutorialPlay === "once";
  useEffect(() => {
    if (!clipTimed) return;
    const take = state.take;
    let last = 0;
    const id = window.setInterval(() => {
      const v = pool.current();
      if (!v) return;
      const wrapped = v.currentTime + 0.5 < last;
      last = v.currentTime;
      if (wrapped && playsOnce) {
        act({ type: "clipEnded" });
        return;
      }
      setClipTime((prev) => ({
        take,
        time: v.currentTime,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        cycle: prev.take !== take ? 0 : v.currentTime < prev.time ? prev.cycle + 1 : prev.cycle,
      }));
    }, 250);
    return () => window.clearInterval(id);
  }, [clipTimed, playsOnce, state.take, pool, act]);
  const clip = clipTime.take === state.take ? clipTime : { time: 0, duration: 0, cycle: 0 };

  // ── While working out ───────────────────────────────

  // Keep the screen on, and pause when the member leaves the tab or locks the phone.
  // Leaving the page pauses — held in place on a rest or get-ready screen, like Pause.
  const onHidden = useEffectEvent(() => {
    if (!state.paused) pause();
  });

  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const request = () => {
      navigator.wakeLock?.request("screen").then(
        (l) => {
          if (gone) l.release().catch(() => {});
          else lock = l;
        },
        () => {},
      );
    };
    const onVisibility = () => {
      if (document.hidden) onHidden();
      else request();
    };
    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      gone = true;
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, act]);

  /** Esc: closes what's open the way its own close does, or pauses and resumes. */
  const onEscape = useEffectEvent(() => {
    if (state.sheet === "guide") finishGuide();
    else if (state.sheet === "settings" && settingsFromGuide) act({ type: "sheet", sheet: "guide" });
    else if (state.sheet) act({ type: "sheet", sheet: null });
    else if (state.paused) resumePlay();
    else pause();
  });
  const onSpace = useEffectEvent(() => (state.paused ? resumePlay() : pause()));
  const onBackKey = useEffectEvent(() => (isVideoPhase(state.phase) ? askRestartVideo() : act({ type: "back" })));

  // Keyboard: arrows move between sets, space pauses, Escape closes a sheet.

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select")) return;
      if (e.key === "Escape") {
        onEscape();
      } else if (e.key === " " && !target?.closest("button") && (!state.sheet || state.sheet === "audio")) {
        e.preventDefault();
        onSpace();
      } else if (running && e.key === "ArrowRight") {
        act({ type: "next" });
      } else if (running && e.key === "ArrowLeft") {
        onBackKey();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, running, state.paused, state.sheet, act]);

  // ── Actions ─────────────────────────────────────────

  function start({
    warmup,
    warmedUp = warmup,
    from,
    activeMs,
  }: {
    warmup: boolean;
    /** For the overview's warm-up row: done or skipped. */
    warmedUp?: boolean;
    from?: number;
    activeMs?: number;
  }) {
    setWarmedUp(warmedUp);
    setMuted(!prefs.instructorAudio);
    // Inside the tap, so every clip — and every audio tip — may play with sound later (see video-pool.tsx).
    pool.unlock();
    tips.unlock();
    countdown.unlock();
    // The music from the top — only when it's on, so a muted member never downloads it.
    if (prefs.music && prefs.instructorAudio) music.begin();
    // First time in this layout (or every time, on the demo): the guide opens
    // before the warm-up, or as the first exercise comes up without one. The
    // phone and desktop guides are remembered separately.
    act({
      type: "begin",
      warmup,
      mode: prefs.tutorialMode,
      guide: guideEveryTime || !(theater ? prefs.seenDesktopGuide : prefs.seenGestureGuide),
      autoAdvance: prefs.autoAdvance,
      from,
      activeMs,
    });
  }

  /** A fresh start (Begin, or Start over): a new session, replacing any saved progress. */
  function begin(withWarmup: boolean) {
    const warmup = withWarmup && !!workout.warmup;
    startSession(warmup);
    setSaved(null);
    start({ warmup });
  }

  /**
   * Restart workout (the pause screen, or once more from the finish): from the
   * warm-up when the workout has one and the Warm-up setting is on. `fresh`
   * starts a new session (the finished one stays finished).
   */
  function restartWorkout(fresh = false) {
    const warmup = prefs.warmup && !!workout.warmup;
    if (fresh) startSession(warmup);
    setWarmedUp(warmup);
    act({ type: "restartWorkout", warmup });
  }

  /** Pick up saved progress: its session, from the set it was on, without the warm-up. */
  function resume() {
    if (!saved || resumeAt === null) return;
    session.current = signedIn ? { id: saved.sessionId, withWarmup: saved.withWarmup } : null;
    start({ warmup: false, warmedUp: saved.withWarmup, from: resumeAt, activeMs: saved.activeSeconds * 1000 });
  }

  /** End workout: keep the progress for Resume, or throw it away; back to the preview. */
  function endWorkout(keep: boolean) {
    const at = targetIndex ?? steps.length;
    const current = session.current;
    if (keep && current) {
      record("progress", at);
      setSaved({
        sessionId: current.id,
        step: at,
        activeSeconds: Math.round(activeTime(state, performance.now()) / 1000),
        sequenceKey: key,
        withWarmup: current.withWarmup,
      });
    } else {
      record("discard", at);
      setSaved(null);
    }
    session.current = null;
    // Back to this workout's preview, not the list.
    setChromeHidden(false);
    act({ type: "exit" });
  }

  /** The guide's Close (or Esc): remembered as seen, in this layout; on with the workout. */
  function finishGuide() {
    setSettingsFromGuide(false);
    updatePrefs(theater ? { seenDesktopGuide: true } : { seenGestureGuide: true });
    act({ type: "sheet", sheet: null });
  }
  /** The guide's Change settings: into Settings, and back to the guide when it closes. */
  function guideToSettings() {
    setSettingsFromGuide(true);
    updatePrefs(theater ? { seenDesktopGuide: true } : { seenGestureGuide: true });
    act({ type: "sheet", sheet: "settings" });
  }
  /**
   * Done, on the summary: back to this workout's preview, like End workout.
   * The finished session was recorded as it completed; any earlier saved spot
   * (a resumed workout) is spent, so the preview offers a fresh Begin.
   */
  function done() {
    setSaved(null);
    setChromeHidden(false);
    act({ type: "exit" });
  }
  // The Audio card's Mute all (stored as instructor audio off, its old name).
  const setMuteAll = (on: boolean) => {
    updatePrefs({ instructorAudio: !on });
    setMuted(on);
    if (!on && prefs.music) music.wake();
  };
  // Auto-advance, from Settings or the pause screen's AUTO pill. Hands-free, a
  // looping tutorial would wait for a tap, so turning it on moves Loop to Play
  // once (Off stays off); the reducer does the same to the player.
  const setAutoAdvance = (on: boolean) => {
    updatePrefs({ autoAdvance: on, tutorialMode: fitTutorialMode(state.mode, on) });
    act({ type: "autoAdvance", on });
  };
  const openOverview = () => act({ type: "sheet", sheet: "overview" });
  const openSettings = () => act({ type: "sheet", sheet: "settings" });
  const openAudio = () => act({ type: "sheet", sheet: "audio" });

  // ── What to show ────────────────────────────────────

  const minutes = aboutMinutes(totalSeconds);
  const setsDone = target?.setIndex ?? setCount;

  function upNext(): { label: string; text: string } {
    const j = setStepFor(steps, state.step + 1);
    if (j === null) return { label: "Up next", text: "Finish" };
    const next = steps[j] as SetStep;
    const name = workout.exercises[next.exerciseId]?.name ?? "Next exercise";
    if (set && next.exerciseId === set.exerciseId && next.setIndex === set.setIndex && next.side) {
      return { label: "Up next", text: `Same move · ${cap(next.side)} side` };
    }
    if (set && next.exerciseId === set.exerciseId && next.block === set.block && !next.groupLabel) {
      return { label: "Up next", text: `${name} · Set ${next.round}` };
    }
    return { label: "Up next", text: next.side ? `${name} · ${cap(next.side)} side` : name };
  }

  function setLine(s: SetStep): string {
    const name = workout.exercises[s.exerciseId]?.name ?? "Exercise";
    if (s.rounds < 2) return name;
    return `${name} · ${s.groupLabel ? "Round" : "Set"} ${s.round} of ${s.rounds}`;
  }

  // How far the set on screen has got, for its segment of the top bar. A
  // tutorial and Get ready leave it empty (the tutorial shows its own progress
  // on Skip), so the segment only ever fills forwards, once.
  const fill: number | null =
    state.phase !== "workout" || !set
      ? null
      : state.stage === "tutorial" || state.stage === "ready"
        ? 0
        : state.timer
          ? // A countdown — a timed set, or a rep set on auto-advance — fills the segment as it runs.
            1 - leftMs / ((set.measure === "time" ? set.amount : set.workSeconds) * 1000)
          : 1;

  const bar = (
    <TopBar>
      <ProgressBar steps={steps} current={state.step} fraction={fill} complete={isFinished(state.phase)} />
    </TopBar>
  );

  // What goes in the video column, and — in the desktop theater layout — what
  // sits beside it.
  let screen: ReactNode = null;
  let beside: ReactNode = null;
  let blurred = false;
  // Lighter than `blurred`: the get-ready screen, where the starting position should show through.
  let softBlur = false;

  // `overview`: the Workout button — not on the intro or outro, which the overview doesn't list.
  const sideButtons = (overview = true): TheaterButton[] => [
    { label: "Settings", aria: "Settings", icon: <Settings />, onClick: openSettings },
    // The audio button from the phone's bottom row, opening the same Audio card.
    { label: "Audio", aria: muted ? "Audio settings (muted)" : "Audio settings", icon: muted ? <Muted /> : <Sound />, onClick: openAudio },
    ...(overview ? [{ label: "Workout", aria: "Open workout overview", icon: <List />, onClick: openOverview }] : []),
    // Held on a rest or get-ready screen, Pause is Resume — like the button under the countdown.
    state.paused
      ? { label: "Resume", aria: "Resume", icon: <Play size={20} />, onClick: resumePlay }
      : { label: "Pause", aria: "Pause", icon: <Pause />, onClick: pause },
  ];

  const videoNow = isVideoPhase(state.phase) ? state.phase : null;
  const videoNowClip = videoNow ? videoClip(workout, videoNow) : null;
  if (videoNow && videoNowClip) {
    // The intro, warm-up, cool-down or outro: one video, start to finish.
    const text = VIDEO_TEXT[videoNow];
    const name = videoName(workout, videoNow);
    const duration = clip.duration || videoNowClip.durationSeconds || 0;
    const fraction = duration ? clip.time / duration : 0;
    const skip = () => act({ type: "next" });
    const skipLabel = `Skip ${text.noun}`;
    const restartLabel = `Restart the ${text.noun}`;
    // The overview lists the warm-up and cool-down, not the intro or outro.
    const withOverview = videoNow === "warmup" || videoNow === "cooldown";
    // Before the exercises, End workout asks what to keep (nothing, yet); after
    // them it's done already, so End goes to the summary.
    const end = isFinished(videoNow) ? () => act({ type: "finish" }) : () => act({ type: "sheet", sheet: "end" });
    const theaterInfo = (
      <TheaterVideoInfo
        chip={{ label: text.label, icon: text.icon(15) }}
        name={name}
        fraction={fraction}
        skipLabel={skipLabel}
        onSkip={skip}
      />
    );
    const arrows = <TheaterArrows onBack={askRestartVideo} onNext={skip} backLabel={restartLabel} nextLabel={skipLabel} />;
    if (state.paused) {
      blurred = true;
      screen = (
        <>
          <Dim />
          <PausedScreen
            subtitle={text.label}
            stats={null}
            onResume={resumePlay}
            onRestartSet={null}
            onRestartWorkout={null}
            onWatchTutorial={null}
            skip={{ label: skipLabel, onClick: skip }}
            onEnd={end}
            // Phones only: Settings, top right, as on the regular pause screen
            // (desktop has it in the column beside the video).
            onSettings={theater ? null : openSettings}
            audio={theater ? null : { muted, onClick: openAudio }}
            autoAdvance={null}
            theater={theater}
          />
        </>
      );
      // Desktop: the video's info stays, dimmed; its arrows (back offers to
      // start it over) and the button column.
      if (theater) {
        beside = (
          <>
            <Dimmed>{theaterInfo}</Dimmed>
            {arrows}
            <TheaterButtons buttons={sideButtons(withOverview)} />
          </>
        );
      }
    } else if (theater) {
      screen = (
        <>
          <TopShade tall />
          <VideoProgress seconds={clip.time} duration={duration} label={text.label} />
          {/* As on a set: the right skips ahead, the left offers to start over, the middle pauses. */}
          <TapZones
            onBack={askRestartVideo}
            onNext={skip}
            onMiddle={pause}
            onHold={pause}
            backLabel={restartLabel}
            nextLabel={skipLabel}
          />
        </>
      );
      beside = (
        <>
          {theaterInfo}
          {arrows}
          <TheaterButtons buttons={sideButtons(withOverview)} />
        </>
      );
    } else {
      screen = (
        <>
          <TopShade tall />
          <TapZones
            onBack={askRestartVideo}
            onNext={skip}
            onMiddle={pause}
            onHold={pause}
            onSwipeDown={() => setChromeHidden(true)}
            // As on the exercises: bring hidden controls back, or else pull up the overview.
            onSwipeUp={() => (chromeHidden ? setChromeHidden(false) : withOverview ? openOverview() : undefined)}
            pullUp={!chromeHidden && withOverview}
            onPullMove={(distance) => {
              if (!pull.active) pull.start();
              pull.move(distance);
            }}
            onPullEnd={(distance, velocity) => {
              if (pull.active) pull.end(distance, velocity);
            }}
            backLabel={restartLabel}
            nextLabel={skipLabel}
          />
          <VideoScreen
            chip={{ label: text.label, icon: text.icon(14) }}
            name={name}
            seconds={clip.time}
            duration={duration}
            skipLabel={skipLabel}
            onPause={pause}
            onSkip={skip}
            muted={muted}
            onAudio={openAudio}
            hidden={chromeHidden}
          />
        </>
      );
    }
  } else if (state.phase === "cooldownPrompt" && workout.cooldown) {
    // The exercises are done: offer the cool-down. Only an answer moves on.
    blurred = true;
    const yes = () => act({ type: "chooseCooldown", yes: true });
    const no = () => act({ type: "chooseCooldown", yes: false });
    screen = (
      <>
        <Dim strength={0.74} />
        {bar}
        <CooldownPrompt
          name={workout.cooldown.name}
          duration={workout.cooldown.clip.durationSeconds}
          onYes={yes}
          onNo={no}
        />
      </>
    );
  } else if (state.phase === "workout" && step) {
    const back = () => act({ type: "back" });
    const next = () => act({ type: "next" });
    // On from a held countdown (Continue, Start now, a tap): unpause as it goes.
    const goOn = () => {
      if (state.paused) resumePlay();
      next();
    };
    // Swipe up: bring hidden controls back, or else open the overview. Swipe
    // down: hide the controls (a swipe down on the overview closes it first).
    const zones = (nextLabel: string) => (
      <TapZones
        onBack={back}
        onNext={goOn}
        onMiddle={state.paused ? resumePlay : pause}
        onHold={pause}
        onSwipeUp={() => (chromeHidden ? setChromeHidden(false) : openOverview())}
        onSwipeDown={() => setChromeHidden(true)}
        pullUp={!chromeHidden && !theater}
        onPullMove={(distance) => {
          if (!pull.active) pull.start();
          pull.move(distance);
        }}
        onPullEnd={(distance, velocity) => {
          if (pull.active) pull.end(distance, velocity);
        }}
        nextLabel={nextLabel}
      />
    );

    // What's on screen, then — paused (other than a held rest or get-ready
    // countdown) — the pause screen over it. On desktop the info left of the
    // video stays, dimmed.
    let info: ReactNode = null;
    if (step.kind === "rest") {
      blurred = true;
      const t = target;
      const tName = t ? (workout.exercises[t.exerciseId]?.name ?? "Next exercise") : "";
      const tAmount = t ? amountLabel(t.measure, t.amount) : "";
      screen = (
        <>
          <Dim />
          {bar}
          {zones("Skip the rest")}
          <RestScreen
            round={step.reason === "round"}
            secondsLeft={leftMs / 1000}
            totalSeconds={step.seconds}
            roundLine={step.reason === "round" && t ? `${t.groupLabel} · round ${t.round} of ${t.rounds} is next` : null}
            next={
              t
                ? {
                    label: step.reason === "round" ? `Up next · Round ${t.round}` : "Up next",
                    name: t.side ? `${tName} · ${cap(t.side)} side` : tName,
                    detail: !t.groupLabel && t.rounds > 1 ? `Set ${t.round} of ${t.rounds} · ${tAmount}` : tAmount,
                    thumbnail: targetExercise?.thumbnail ?? null,
                  }
                : null
            }
            paused={state.paused}
            onPause={pause}
            onResume={resumePlay}
            onContinue={goOn}
            tip={!theater && step.tip ? coach() : null}
            theater={theater}
          />
          {/* Desktop: the tip's photo by the video's corner, as on a set (a bubble's height up from it). */}
          {theater && step.tip && <div className="pointer-events-none absolute bottom-8 right-8 -translate-y-full">{coach(true)}</div>}
          {/* Phones: Settings (top right) and audio (top left) while the countdown is held, as on the pause screen. */}
          {!theater && state.paused && <CornerSettings onClick={openSettings} />}
          {!theater && state.paused && <CornerAudio muted={muted} onClick={openAudio} />}
        </>
      );
      // Desktop: the arrows and the button column beside the video, as on every other screen.
      if (theater) {
        beside = (
          <>
            <TheaterArrows onBack={back} onNext={goOn} nextLabel="Skip the rest" />
            <TheaterButtons buttons={sideButtons()} />
          </>
        );
      }
    } else if (set && state.stage === "ready") {
      softBlur = true;
      const readyLine =
        set.rounds > 1
          ? set.groupLabel
            ? `${set.groupLabel} · Round ${set.round} of ${set.rounds}`
            : `Set ${set.round} of ${set.rounds}`
          : null;
      screen = (
        <>
          <Dim strength={0.56} />
          {bar}
          {zones("Start now")}
          <ReadyScreen
            name={exercise?.name ?? "Exercise"}
            metric={set.measure === "reps" ? { kind: "reps", amount: set.amount } : { kind: "time", seconds: set.amount }}
            side={set.side}
            setLine={readyLine}
            levels={exercise?.dumbbellLevels.length ? levelsLabel(exercise.dumbbellLevels) : null}
            secondsLeft={leftMs / 1000}
            totalSeconds={GET_READY_MS / 1000}
            paused={state.paused}
            onPause={pause}
            onResume={resumePlay}
            onStart={goOn}
            theater={theater}
          />
          {!theater && state.paused && <CornerSettings onClick={openSettings} />}
          {!theater && state.paused && <CornerAudio muted={muted} onClick={openAudio} />}
        </>
      );
      if (theater) {
        beside = (
          <>
            <TheaterArrows onBack={back} onNext={goOn} nextLabel="Start now" />
            <TheaterButtons buttons={sideButtons()} />
          </>
        );
      }
    } else if (set && state.stage === "tutorial") {
      const amount = amountLabel(set.measure, set.amount, exercise?.sided);
      const duration = clip.duration || exercise?.tutorial?.durationSeconds || 0;
      const name = exercise?.name ?? "Exercise";
      const chips = [set.rounds > 1 ? `${set.rounds} ${set.groupLabel ? "rounds" : "sets"} · ${amount}` : amount];
      const levels = exercise?.dumbbellLevels.length ? levelsLabel(exercise.dumbbellLevels) : null;
      // Looping or playing once, the button fills as the tutorial plays and counts
      // down what's left of it; a looping one just starts over.
      const progress = {
        fraction: duration ? clip.time / duration : 0,
        secondsLeft: Math.max(0, duration - clip.time),
        cycle: clip.cycle,
        loops: state.tutorialPlay === "loop",
      };
      if (theater) {
        screen = (
          <>
            <TopShade />
            {bar}
            {zones("Start the exercise")}
          </>
        );
        info = <TheaterTutorialInfo name={name} chips={chips} levels={levels} progress={progress} onBegin={next} />;
        beside = (
          <>
            {info}
            <TheaterArrows onBack={back} onNext={next} nextLabel="Start the exercise" />
            <TheaterButtons buttons={sideButtons()} />
          </>
        );
      } else {
        screen = (
          <>
            <TopShade />
            {bar}
            {zones("Start the exercise")}
            <TutorialScreen
              name={name}
              chips={chips}
              levels={levels}
              progress={progress}
              hidden={chromeHidden}
              onBegin={next}
              onPause={pause}
              muted={muted}
              onAudio={openAudio}
            />
          </>
        );
      }
    } else if (set) {
      const name = exercise?.name ?? "Exercise";
      const metric =
        set.measure === "time"
          ? ({ kind: "time", seconds: Math.ceil(leftMs / 1000) } as const)
          : ({ kind: "reps", amount: set.amount } as const);
      const groupLine = set.groupLabel ? `${set.groupLabel} · Round ${set.round} of ${set.rounds}` : null;
      const pill = upNext();
      if (theater) {
        screen = (
          <>
            <TopShade />
            {bar}
            {zones("Next set")}
            <div className="pointer-events-none absolute bottom-8 right-8 -translate-y-full">
              {coach(true)}
            </div>
          </>
        );
        info = (
          <TheaterSetInfo
            name={name}
            metric={metric}
            side={set.side}
            groupLine={groupLine}
            upNext={pill.text}
            fill={state.timer && state.stage === "exercise" ? fill : null}
          />
        );
        beside = (
          <>
            {info}
            <TheaterArrows onBack={back} onNext={next} nextLabel="Next set" />
            <TheaterButtons buttons={sideButtons()} />
          </>
        );
      } else {
        screen = (
          <>
            <TopShade />
            {bar}
            {zones("Next set")}
            <SetScreen
              name={name}
              metric={metric}
              side={set.side}
              groupLine={groupLine}
              pill={pill}
              // Moving on by itself (auto-advance, or a timed set): Up next fills as it counts down.
              fill={state.timer && state.stage === "exercise" ? fill : null}
              hidden={chromeHidden}
              onPause={pause}
              onOverview={openOverview}
              muted={muted}
              onAudio={openAudio}
              tip={coach()}
            />
          </>
        );
      }
    }
    if (state.paused && !(holdInPlace && onCountdown)) {
      blurred = true;
      const canWatch = !!targetExercise?.tutorial;
      screen = (
        <>
          <Dim />
          {bar}
          <PausedScreen
            subtitle={set ? setLine(set) : "Rest"}
            stats={{
              elapsed: clock(activeTime(state, 0) / 1000),
              setsDone: `${setsDone} / ${setCount}`,
              left: `~${aboutMinutes(secondsLeft(steps, state.step))} min`,
            }}
            onResume={resumePlay}
            onRestartSet={() => act({ type: "restartSet" })}
            restartSetLabel={state.stage === "tutorial" ? "Restart tutorial" : "Restart this set"}
            onRestartWorkout={() => restartWorkout()}
            // During a tutorial, Restart tutorial already covers it.
            onWatchTutorial={canWatch && state.stage !== "tutorial" ? () => act({ type: "watchTutorial" }) : null}
            skip={null}
            onEnd={() => act({ type: "sheet", sheet: "end" })}
            // Desktop has Settings in the column beside the video instead.
            onSettings={theater ? null : openSettings}
            audio={theater ? null : { muted, onClick: openAudio }}
            autoAdvance={{ on: state.autoAdvance, onChange: setAutoAdvance }}
            theater={theater}
          />
        </>
      );
      // Desktop: the arrows and the button column beside the video, as on a
      // held rest or get-ready screen (Pause reads Resume while paused).
      if (theater) {
        const nextLabel =
          step.kind === "rest"
            ? "Skip the rest"
            : state.stage === "tutorial"
              ? "Start the exercise"
              : state.stage === "ready"
                ? "Start now"
                : "Next set";
        beside = (
          <>
            {info && <Dimmed>{info}</Dimmed>}
            <TheaterArrows onBack={back} onNext={goOn} nextLabel={nextLabel} />
            <TheaterButtons buttons={sideButtons()} />
          </>
        );
      }
    }
  } else if (state.phase === "complete") {
    blurred = true;
    screen = (
      <>
        <Dim strength={0.74} />
        {bar}
        <CompleteScreen
          title={workout.title}
          time={clock(activeTime(state, 0) / 1000)}
          exercises={exerciseCount}
          sets={setCount}
          onDone={done}
          rating={signedIn ? { stars, onRate: rate } : null}
          onRestart={() => restartWorkout(true)}
          theater={theater}
        />
      </>
    );
  }

  const leftNow = secondsLeft(steps, state.step);
  const equipment = equipmentText(workout);
  // The overview: on phones a drawer that stays mounted all workout (parked
  // below the screen, see Drawer); on desktop a side panel while open.
  const overview =
    (state.phase === "workout" || state.phase === "warmup" || state.phase === "cooldown") &&
    (!theater || state.sheet === "overview") ? (
      <OverviewSheet
        workout={workout}
        steps={steps}
        subtitle={`About ${minutes} min${equipment ? ` · ${equipment}` : ""}`}
        progress={
          state.phase === "cooldown"
            ? { label: "Cool-down", left: "Exercises done", fraction: 1 }
            : {
                label: state.phase === "warmup" ? "Warm-up" : set ? setLine(set) : "Resting",
                left: `About ${aboutMinutes(leftNow)} min left`,
                fraction: totalSeconds ? Math.min(1, Math.max(0, 1 - leftNow / secondsLeft(steps, 0))) : 0,
              }
        }
        position={{
          step: state.step,
          complete: state.phase === "cooldown",
          warmup: state.phase === "warmup" ? "now" : warmedUp ? "done" : "skipped",
          cooldown: state.phase === "cooldown" ? "now" : "todo",
        }}
        // The exercises are behind them in the cool-down: nothing to jump to.
        onJump={state.phase === "cooldown" ? undefined : (i) => act({ type: "jump", step: i })}
        onClose={() => act({ type: "sheet", sheet: null })}
        drawer={theater ? undefined : { open: state.sheet === "overview", pull, onOpen: openOverview }}
      />
    ) : null;
  // Settings and End workout: on phones, drawers kept mounted through the
  // workout (like the overview) so they slide rather than pop; on desktop, a
  // side panel and a dialog while open.
  const settings =
    active && (!theater || state.sheet === "settings") ? (
      <SettingsSheet
        mode={state.mode}
        onMode={(mode) => {
          updatePrefs({ tutorialMode: mode });
          act({ type: "mode", mode });
        }}
        autoAdvance={{ on: state.autoAdvance, onChange: setAutoAdvance }}
        onGuide={() => {
          // "How to use the player": this layout's guide, from the start.
          setSettingsFromGuide(false);
          act({ type: "sheet", sheet: "guide" });
        }}
        onClose={() => act({ type: "sheet", sheet: settingsFromGuide ? "guide" : null })}
        variant={theater ? "side" : "bottom"}
        drawerOpen={theater ? undefined : state.sheet === "settings"}
      />
    ) : null;
  // The Audio card (the audio button): a drawer on phones, a side panel on desktop, like Settings.
  const audio =
    active && (!theater || state.sheet === "audio") ? (
      <AudioSheet
        muteAll={{ on: muted, onChange: setMuteAll }}
        music={{
          on: prefs.music,
          onChange: (on) => {
            updatePrefs({ music: on });
            if (on && !muted) music.wake();
          },
        }}
        tips={{ on: prefs.audioTips, onChange: (on) => updatePrefs({ audioTips: on }) }}
        effects={{ on: prefs.soundEffects, onChange: (on) => updatePrefs({ soundEffects: on }) }}
        mix={canMix ? { on: prefs.mixAudio, onChange: (on) => updatePrefs({ mixAudio: on }) } : null}
        onClose={() => act({ type: "sheet", sheet: null })}
        variant={theater ? "side" : "bottom"}
        drawerOpen={theater ? undefined : state.sheet === "audio"}
      />
    ) : null;
  const end =
    active && (!theater || state.sheet === "end") ? (
      <EndSheet
        setsDone={setsDone}
        setsTotal={setCount}
        // Signed in and past the first set, there's progress worth keeping.
        canSave={signedIn && targetIndex !== null && targetIndex > 0}
        onEnd={endWorkout}
        onCancel={() => act({ type: "sheet", sheet: null })}
        variant={theater ? "dialog" : "bottom"}
        drawerOpen={theater ? undefined : state.sheet === "end"}
      />
    ) : null;

  return (
    <>
      {state.phase === "preview" && (
        <WorkoutPreview
          workout={workout}
          steps={steps}
          totalSeconds={totalSeconds}
          exerciseCount={exerciseCount}
          backHref={backHref}
          warmup={prefs.warmup}
          onWarmup={(on) => updatePrefs({ warmup: on })}
          onBegin={begin}
          resume={
            resumeAt !== null && saved
              ? { step: resumeAt, percent: workoutProgress(steps, resumeAt).percent, warmedUp: saved.withWarmup }
              : null
          }
          onResume={resume}
          doneAt={doneAt}
        />
      )}
      {/* The stage. During the preview it's invisible but mounted, so the
          first clips load while the member reads. `--col` is the video
          column's width: the whole screen on a phone, 9:16 of its height on
          anything wider. */}
      <div
        aria-hidden={state.phase === "preview"}
        className={`fixed inset-0 flex select-none justify-center bg-[#08080F] text-white ${
          state.phase === "preview" ? "pointer-events-none -z-10 opacity-0" : "z-50"
        }`}
        style={{ "--col": "min(100vw, 100dvh * 9 / 16)" } as CSSProperties}
      >
        <div className="relative h-full w-(--col) overflow-hidden bg-[#14142B]">
          <PoolVideos
            pool={pool}
            className={`transition-[filter,transform] duration-300 ${
              blurred ? "scale-[1.06] blur-[4px] saturate-[0.8]" : softBlur ? "scale-[1.03] blur-[2px]" : ""
            }`}
          />
          <LoadingSpinner
            show={buffering && running && (isVideoPhase(state.phase) || (state.phase === "workout" && step?.kind === "set"))}
          />
          {screen}
          {!theater && overview}
          {!theater && settings}
          {!theater && audio}
          {!theater && end}
          {state.sheet === "restartVideo" && videoNow && (
            <RestartVideoPrompt
              title={`Restart the ${VIDEO_TEXT[videoNow].noun}?`}
              onRestart={() => act({ type: "restartVideo" })}
              onCancel={() => act({ type: "sheet", sheet: null })}
              // Before the exercises there's nothing to save, so no second
              // question; after them the workout's done, so it's the summary.
              onEnd={isFinished(videoNow) ? () => act({ type: "finish" }) : () => endWorkout(false)}
            />
          )}
          {!theater && state.sheet === "guide" && (
            <GestureGuide
              settings={{ mode: state.mode, autoAdvance: state.autoAdvance }}
              startOnSettings={settingsFromGuide}
              onSettings={guideToSettings}
              onDone={finishGuide}
            />
          )}
        </div>
        {theater && beside}
        {theater && overview}
        {theater && settings}
        {theater && audio}
        {theater && end}
        {theater && state.sheet === "guide" && (
          <DesktopGuide
            settings={{ mode: state.mode, autoAdvance: state.autoAdvance }}
            startOnSettings={settingsFromGuide}
            onSettings={guideToSettings}
            onDone={finishGuide}
          />
        )}
      </div>
    </>
  );
}
