"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  aboutMinutes,
  activeTime,
  estimateWorkout,
  initialPlayerState,
  isRunning,
  playerReducer,
  secondsLeft,
  setStepFor,
  workoutSteps,
  type PlayerAction,
  type SetStep,
  type WorkoutStep,
} from "@move-mindful/core";
import { levelsLabel } from "@/lib/exercises/shared";
import { amountLabel, clock, equipmentText, loopFor, type PlayerClip, type PlayerWorkout } from "@/lib/workouts/player";
import { OverviewSheet } from "./overview-sheet";
import { ProgressBar, type SegmentFill } from "./progress-bar";
import {
  CompleteScreen,
  Dim,
  EndSheet,
  PausedScreen,
  RestScreen,
  SetScreen,
  TopShade,
  LoadingSpinner,
  TapZones,
  TopBar,
  TutorialScreen,
  SettingsSheet,
  WarmupProgress,
  createSheetPull,
  WarmupScreen,
} from "./player-screens";
import { List, Pause, Settings } from "./icons";
import {
  TheaterArrows,
  TheaterButtons,
  TheaterSetInfo,
  TheaterTutorialInfo,
  TheaterWarmupInfo,
  useTheater,
  type TheaterButton,
} from "./theater";
import { POOL_SIZE, PoolVideos, useVideoPool, type PoolClip, type ShownClip } from "./video-pool";
import { WorkoutPreview } from "./workout-preview";
import { GestureGuide } from "./gesture-guide";
import { usePlayerPreferences } from "./preferences";
import type { PlayerPreferences } from "@/lib/member/preferences";

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

function useCanMixAudio(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => !!(navigator as AudioSessionNavigator).audioSession,
    () => false,
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Only tutorials and the warm-up are heard: an exercise's loop always plays
// muted, even if its file has sound.
function shownOf(clip: PlayerClip | null | undefined, loop: boolean, silent = false): ShownClip | null {
  return clip ? { url: clip.url, poster: clip.poster, loop, silent } : null;
}

export function WorkoutPlayer({
  workout,
  backHref,
  preferences,
  signedIn,
}: {
  workout: PlayerWorkout;
  backHref: string;
  /** The member's saved settings (null when signed out) — see usePlayerPreferences. */
  preferences: Partial<PlayerPreferences> | null;
  signedIn: boolean;
}) {
  const router = useRouter();

  const estimates = useMemo(
    () => Object.fromEntries(Object.values(workout.exercises).map((e) => [e.id, e.estimate])),
    [workout.exercises],
  );
  const steps = useMemo(() => workoutSteps(workout.blocks, estimates), [workout.blocks, estimates]);
  const totalSeconds = useMemo(() => estimateWorkout(workout.blocks, estimates).totalSeconds, [workout.blocks, estimates]);
  const setSteps = steps.filter((s): s is SetStep => s.kind === "set");
  const setCount = setSteps.length ? setSteps[setSteps.length - 1].setIndex + 1 : 0;
  const exerciseCount = new Set(setSteps.map((s) => s.exerciseId)).size;

  const reducer = useMemo(
    () => playerReducer({ steps, hasTutorial: (id) => !!workout.exercises[id]?.tutorial }),
    [steps, workout.exercises],
  );
  const [state, dispatch] = useReducer(reducer, initialPlayerState);
  const act = useCallback((a: WithoutNow<PlayerAction>) => dispatch({ ...a, now: performance.now() } as PlayerAction), []);

  const [prefs, updatePrefs] = usePlayerPreferences({ account: preferences, signedIn });
  const canMix = useCanMixAudio();

  // "Keep my music playing": an "ambient" session mixes with other apps'
  // audio (iOS then lets the Silent switch mute it); "auto" is the default,
  // where instructor audio pauses them. Set before anything plays, and put back
  // on the way out.
  useEffect(() => {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (!session) return;
    try {
      session.type = prefs.mixAudio ? "ambient" : "auto";
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
  }, [prefs.mixAudio]);
  const [muted, setMuted] = useState(false);
  const [warmedUp, setWarmedUp] = useState(false);
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
  const active = state.phase === "warmup" || state.phase === "workout";
  const step: WorkoutStep | undefined = steps[state.step];
  const set = step?.kind === "set" ? step : null;
  const exercise = set ? workout.exercises[set.exerciseId] : undefined;
  // The set this step is, or — for a rest — the one it leads into.
  const targetIndex = setStepFor(steps, state.step);
  const target = targetIndex !== null ? (steps[targetIndex] as SetStep) : null;
  const targetExercise = target ? workout.exercises[target.exerciseId] : undefined;

  // ── Videos ──────────────────────────────────────────

  const shown = useMemo<ShownClip | null>(() => {
    if (state.phase === "preview") return null;
    if (state.phase === "warmup") return shownOf(workout.warmup?.clip, false);
    const st = steps[state.step];
    if (!st) return null;
    // A rest shows the next exercise (blurred); the summary, the last one.
    if (st.kind === "rest" || state.phase === "complete") {
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
    const started = state.phase === "workout" || state.phase === "complete";
    if (!started) add(workout.warmup?.clip);
    for (let i = started ? state.step : 0; i < steps.length && list.length < POOL_SIZE; i++) {
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
    return list;
  }, [shown, state.phase, state.step, state.stage, state.mode, state.seen, steps, workout]);

  // Sheets stop the clock. The video keeps playing behind the overview (so
  // pulling it up doesn't stutter) but pauses under Settings and End workout.
  const playing = running || (state.phase === "workout" && !state.paused && state.sheet === "overview");
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

  // How far the warm-up or a tutorial has got. `cycle` counts a looping
  // tutorial's trips round, so its progress can restart without sliding back.
  const clipTimed = state.phase === "warmup" || (state.phase === "workout" && state.stage === "tutorial");
  const [clipTime, setClipTime] = useState({ take: -1, time: 0, duration: 0, cycle: 0 });
  useEffect(() => {
    if (!clipTimed) return;
    const take = state.take;
    const id = window.setInterval(() => {
      const v = pool.current();
      if (!v) return;
      setClipTime((prev) => ({
        take,
        time: v.currentTime,
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        cycle: prev.take !== take ? 0 : v.currentTime < prev.time ? prev.cycle + 1 : prev.cycle,
      }));
    }, 250);
    return () => window.clearInterval(id);
  }, [clipTimed, state.take, pool]);
  const clip = clipTime.take === state.take ? clipTime : { time: 0, duration: 0, cycle: 0 };

  // ── While working out ───────────────────────────────

  // Keep the screen on, and pause when the member leaves the tab or locks the phone.
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
      if (document.hidden) act({ type: "pause" });
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

  // Keyboard: arrows move between sets, space pauses, Escape closes a sheet.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest("input, textarea, select")) return;
      if (e.key === "Escape") {
        if (state.sheet) act({ type: "sheet", sheet: null });
        else act({ type: state.paused ? "resume" : "pause" });
      } else if (e.key === " " && !target?.closest("button") && !state.sheet) {
        e.preventDefault();
        act({ type: state.paused ? "resume" : "pause" });
      } else if (running && e.key === "ArrowRight") {
        act({ type: "next" });
      } else if (running && e.key === "ArrowLeft") {
        act({ type: "back" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, running, state.paused, state.sheet, act]);

  // ── Actions ─────────────────────────────────────────

  function begin(withWarmup: boolean) {
    const warmup = withWarmup && !!workout.warmup;
    setWarmedUp(warmup);
    setMuted(!prefs.instructorAudio);
    // Inside the tap, so every clip may play with sound later (see video-pool.tsx).
    pool.unlock();
    // First time on a phone: the gesture guide opens as the first exercise comes up.
    act({ type: "begin", warmup, mode: prefs.tutorialMode, guide: !theater && !prefs.seenGestureGuide });
  }

  const leave = () => router.push(backHref);
  const pause = () => act({ type: "pause" });
  const setSound = (on: boolean) => {
    updatePrefs({ instructorAudio: on });
    setMuted(!on);
  };
  const openOverview = () => act({ type: "sheet", sheet: "overview" });
  const openSettings = () => act({ type: "sheet", sheet: "settings" });

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

  const fill: SegmentFill | null =
    state.phase !== "workout" || !set
      ? null
      : state.stage === "tutorial"
        ? { kind: "tutorial", fraction: state.tutorialPlay === "once" && clip.duration ? clip.time / clip.duration : 1 }
        : set.measure === "time"
          ? { kind: "set", fraction: 1 - leftMs / (set.amount * 1000) }
          : { kind: "set", fraction: 1 };

  const bar = (
    <TopBar>
      <ProgressBar steps={steps} current={state.step} fill={fill} complete={state.phase === "complete"} />
    </TopBar>
  );

  // What goes in the video column, and — in the desktop theater layout — what
  // sits beside it.
  let screen: ReactNode = null;
  let beside: ReactNode = null;
  let blurred = false;

  const sideButtons = (): TheaterButton[] => [
    { label: "Settings", aria: "Settings", icon: <Settings />, onClick: openSettings },
    ...(state.phase === "workout"
      ? [{ label: "Workout", aria: "Open workout overview", icon: <List />, onClick: openOverview }]
      : []),
    { label: "Pause", aria: "Pause", icon: <Pause />, onClick: pause },
  ];

  if (state.phase === "warmup" && workout.warmup) {
    const duration = clip.duration || workout.warmup.clip.durationSeconds || 0;
    const skip = () => act({ type: "endWarmup" });
    if (state.paused) {
      blurred = true;
      screen = (
        <>
          <Dim />
          <PausedScreen
            subtitle="Warm-up"
            stats={null}
            onResume={() => act({ type: "resume" })}
            onRestartSet={null}
            onRestartWorkout={null}
            onWatchTutorial={null}
            onSkipWarmup={skip}
            onEnd={() => act({ type: "sheet", sheet: "end" })}
            onSettings={null}
            theater={theater}
          />
        </>
      );
    } else if (theater) {
      screen = (
        <>
          <TopShade tall />
          <WarmupProgress seconds={clip.time} duration={duration} />
          {/* Tap the middle (or hold) to pause; the sides do nothing on the warm-up. */}
          <TapZones onMiddle={pause} onHold={pause} />
        </>
      );
      beside = (
        <>
          <TheaterWarmupInfo name={workout.warmup.name} onSkip={skip} />
          <TheaterButtons buttons={sideButtons()} />
        </>
      );
    } else {
      screen = (
        <>
          <TopShade tall />
          <TapZones onMiddle={pause} onHold={pause} />
          <WarmupScreen
            name={workout.warmup.name}
            seconds={clip.time}
            duration={duration}
            onPause={pause}
            onSkip={skip}
            muted={muted}
            onToggleSound={() => setSound(muted)}
          />
        </>
      );
    }
  } else if (state.phase === "workout" && step) {
    const back = () => act({ type: "back" });
    const next = () => act({ type: "next" });
    // Swipe up: bring hidden controls back, or else open the overview. Swipe
    // down: hide the controls (a swipe down on the overview closes it first).
    const zones = (nextLabel: string) => (
      <TapZones
        onBack={back}
        onNext={next}
        onMiddle={pause}
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

    if (state.paused) {
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
            onResume={() => act({ type: "resume" })}
            onRestartSet={() => act({ type: "restartSet" })}
            onRestartWorkout={() => act({ type: "restartWorkout" })}
            onWatchTutorial={canWatch ? () => act({ type: "watchTutorial" }) : null}
            onSkipWarmup={null}
            onEnd={() => act({ type: "sheet", sheet: "end" })}
            onSettings={openSettings}
            theater={theater}
          />
        </>
      );
    } else if (step.kind === "rest") {
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
            onPause={pause}
            onContinue={next}
            theater={theater}
          />
        </>
      );
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
        beside = (
          <>
            <TheaterTutorialInfo name={name} chips={chips} levels={levels} progress={progress} onBegin={next} />
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
              pill={{
                label: "Workout",
                text: `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} · ${minutes} min`,
              }}
              hidden={chromeHidden}
              onBegin={next}
              onPause={pause}
              onOverview={openOverview}
              muted={muted}
              onToggleSound={() => setSound(muted)}
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
          </>
        );
        beside = (
          <>
            <TheaterSetInfo name={name} metric={metric} side={set.side} groupLine={groupLine} upNext={pill.text} />
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
              hidden={chromeHidden}
              onPause={pause}
              onOverview={openOverview}
              muted={muted}
              onToggleSound={() => setSound(muted)}
            />
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
          onDone={leave}
          onRestart={() => act({ type: "restartWorkout" })}
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
    state.phase === "workout" && (!theater || state.sheet === "overview") ? (
      <OverviewSheet
        workout={workout}
        steps={steps}
        subtitle={`About ${minutes} min${equipment ? ` · ${equipment}` : ""}`}
        progress={{
          label: set ? setLine(set) : "Resting",
          left: `About ${aboutMinutes(leftNow)} min left`,
          fraction: totalSeconds ? Math.min(1, Math.max(0, 1 - leftNow / secondsLeft(steps, 0))) : 0,
        }}
        position={{ step: state.step, complete: false, warmup: warmedUp ? "done" : "skipped" }}
        onJump={(i) => act({ type: "jump", step: i })}
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
        soundOn={!muted}
        mix={canMix ? { on: prefs.mixAudio, onChange: (on) => updatePrefs({ mixAudio: on }) } : null}
        onMode={(mode) => {
          updatePrefs({ tutorialMode: mode });
          act({ type: "mode", mode });
        }}
        onSound={setSound}
        onGuide={theater ? null : () => act({ type: "sheet", sheet: "guide" })}
        onClose={() => act({ type: "sheet", sheet: null })}
        variant={theater ? "side" : "bottom"}
        drawerOpen={theater ? undefined : state.sheet === "settings"}
      />
    ) : null;
  const end =
    active && (!theater || state.sheet === "end") ? (
      <EndSheet
        setsDone={setsDone}
        setsTotal={setCount}
        onEnd={() => {
          // Back to this workout's preview, not the list.
          setChromeHidden(false);
          act({ type: "exit" });
        }}
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
            className={`transition-[filter,transform] duration-300 ${blurred ? "scale-[1.06] blur-[4px] saturate-[0.8]" : ""}`}
          />
          <LoadingSpinner
            show={buffering && running && (state.phase === "warmup" || (state.phase === "workout" && step?.kind === "set"))}
          />
          {screen}
          {!theater && overview}
          {!theater && settings}
          {!theater && end}
          {!theater && state.sheet === "guide" && (
            <GestureGuide
              onDone={() => {
                updatePrefs({ seenGestureGuide: true });
                act({ type: "sheet", sheet: null });
              }}
            />
          )}
        </div>
        {theater && beside}
        {theater && overview}
        {theater && settings}
        {theater && end}
      </div>
    </>
  );
}
