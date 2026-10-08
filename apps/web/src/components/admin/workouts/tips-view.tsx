"use client";

import { useEffect, useRef, useState } from "react";
import {
  cueAt,
  isWarmup,
  WARMUP_CUE,
  groupLabels,
  workoutSteps,
  type AudioTip,
  type SetStep,
  type TipCue,
  type EstimateExercise,
  type TipSlot,
  type WorkoutBlock,
  type WorkoutStep,
} from "@move-mindful/core";
import { uploadWorkoutTip } from "@/app/actions/workouts";
import { formatDuration } from "@/lib/exercises/shared";
import {
  RUNDOWN,
  RUNDOWN_TIP_SLOT,
  TIP_DELAY_SECONDS,
  TIP_MAX_SECONDS,
  tipUrl,
  type CatalogExercise,
} from "@/lib/workouts/shared";
import { readRecording, withReading } from "@/lib/workouts/trim";
import { OverviewPreview } from "@/components/admin/workouts/overview-preview";

// The builder's "Audio tips" view: the workout as members walk it — the
// workout overview after the intro, then every set (each side of a sided one)
// and every rest, the ones the builder adds between sets and rounds included —
// each with a tip to record from the microphone,
// play back, redo or remove. Recordings upload straight away; the sequence
// points at them once the workout is saved (see uploadWorkoutTip). The dead
// air before and after the speech is trimmed off automatically — the file
// stays whole, and the tip plays just the speech (AudioTip start / end) — and
// the voice's loudness is measured for the player's equalizer bars (`levels`).

// What the browser records in: AAC in MP4 (Chrome, Safari), which every
// phone and browser can play. Firefox only records Opus, so it can't record tips.
const RECORD_TYPES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"];

const slotId = (s: TipSlot) => `${s.block}/${s.move ?? "-"}/${s.key}`;
/** Recorded before trimming, or before voice levels: the view reads it again. */
const unread = (tip: AudioTip) => tip.end === undefined || tip.levels === undefined;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A row: where its tip goes, the tip, and the seconds it has before its set or rest ends. */
type Entry = { tipSlot: TipSlot; tip: AudioTip | null; room: number };

function entry(s: WorkoutStep): Entry {
  return { tipSlot: s.tipSlot, tip: s.tip, room: room(s) };
}

/** Seconds between the tip starting and its set or rest ending (for a rep set, the reps at the clip's pace). */
function room(s: WorkoutStep): number {
  if (s.kind === "rest") return s.seconds - TIP_DELAY_SECONDS.rest;
  return (s.measure === "time" ? s.amount : s.workSeconds) - TIP_DELAY_SECONDS.set;
}

/** A slot being recorded (`startedAt` once the recorder has started, on the page's clock) or saved. */
type Busy = { slot: string; phase: "recording" | "saving"; startedAt: number | null } | null;

export function TipsView({
  blocks,
  rundownTip,
  estimates,
  byId,
  instructorName,
  ensureSaved,
  onTip,
  unsaved,
  onSave,
}: {
  blocks: WorkoutBlock[];
  /** The workout overview's tip (in RUNDOWN_TIP_SLOT): kept on the workout, not a block. */
  rundownTip: AudioTip | null;
  estimates: Record<string, EstimateExercise>;
  byId: Map<string, CatalogExercise>;
  /** The workout's instructor, for the explanation at the top. */
  instructorName: string | null;
  /** The workout's id, saving it first if it's new — a recording needs somewhere to go. */
  ensureSaved: () => Promise<string | null>;
  onTip: (slot: TipSlot, tip: AudioTip | null) => void;
  /** Tips recorded or removed since the last save. */
  unsaved: boolean;
  /** Save the workout; false if it didn't. */
  onSave: () => Promise<boolean>;
}) {
  const steps = workoutSteps(blocks, estimates);
  const labels = groupLabels(blocks);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const recorder = useRef<{ rec: MediaRecorder; discard: boolean } | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  // The workout overview's tip records and plays back over the overview
  // itself (OverviewPreview): recording, each exercise tapped is a cue — the
  // one being talked about from then — and playing back, the highlight
  // follows those cues, as it will for members.
  const overviewId = slotId(RUNDOWN_TIP_SLOT);
  // What the overview opens on: the warm-up (one row), or the first exercise.
  const firstSet = steps.find((s) => s.kind === "set") as SetStep | undefined;
  const firstExercise = firstSet ? (isWarmup(blocks[firstSet.block]) ? WARMUP_CUE : firstSet.exerciseId) : null;
  // "ready": open to review the sequence before recording; "record": recording; "play": playing back.
  const [preview, setPreview] = useState<"ready" | "record" | "play" | null>(null);
  const [cueNow, setCueNow] = useState<string | null>(null);
  const [playTime, setPlayTime] = useState(0);
  const cues = useRef<TipCue[]>([]);

  // Tips recorded before trimming or voice levels existed: read them once, as
  // the view opens, and keep what's found — the Save bar then asks for a save.
  const overview: Entry = { tipSlot: RUNDOWN_TIP_SLOT, tip: rundownTip, room: Infinity };
  const entries: Entry[] = [overview, ...steps.map(entry)];
  const latest = useRef({ entries, onTip });
  useEffect(() => {
    latest.current = { entries, onTip };
  });
  const tried = useRef(new Set<string>());
  const unreadIds = entries.flatMap((e) => (e.tip && unread(e.tip) ? [e.tip.id] : [])).join(",");
  useEffect(() => {
    for (const id of unreadIds ? unreadIds.split(",") : []) {
      if (tried.current.has(id)) continue;
      tried.current.add(id);
      fetch(tipUrl(id))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then(readRecording)
        .then((reading) => {
          // Still there, still unread (nothing moved meanwhile)?
          const entry = latest.current.entries.find((e) => e.tip?.id === id);
          if (reading && entry?.tip && unread(entry.tip)) latest.current.onTip(entry.tipSlot, withReading(entry.tip, reading));
        })
        .catch(() => {
          // Couldn't fetch or decode it: it plays as it did.
        });
    }
  }, [unreadIds]);

  // The seconds ticking up while recording.
  const recording = busy?.phase === "recording";
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(id);
  }, [recording]);

  // Leaving the view: drop a recording in progress, stop playback.
  useEffect(
    () => () => {
      const current = recorder.current;
      if (current && current.rec.state === "recording") {
        current.discard = true;
        current.rec.stop();
      }
      player.current?.pause();
    },
    [],
  );

  function stopPlayback() {
    player.current?.pause();
    setPlaying(null);
    setPreview((o) => (o === "play" ? null : o));
  }

  function play(tip: AudioTip, id: string) {
    if (playing === id) {
      stopPlayback();
      return;
    }
    const el = (player.current ??= new Audio());
    const start = tip.start ?? 0;
    // The workout overview's plays back in the overview, the highlight following its cues.
    const following = id === overviewId;
    const tipCues = tip.cues ?? [];
    if (following) {
      setCueNow(cueAt(tipCues, start)?.exerciseId ?? firstExercise);
      setPlayTime(0);
      setPreview("play");
    }
    el.onended = () => stopPlayback();
    // Just the speech, when it's been trimmed: from `start`, stopping at `end`.
    el.ontimeupdate = () => {
      if (following) {
        setCueNow(cueAt(tipCues, el.currentTime)?.exerciseId ?? firstExercise);
        setPlayTime(Math.max(0, el.currentTime - start));
      }
      if (tip.end !== undefined && el.currentTime >= tip.end) stopPlayback();
    };
    el.onloadedmetadata = () => {
      if (Math.abs(el.currentTime - start) > 0.05) el.currentTime = start;
    };
    el.src = tipUrl(tip.id);
    el.currentTime = start;
    setPlaying(id);
    el.play().catch(() => {
      stopPlayback();
      setError("Couldn’t play that tip.");
    });
  }

  async function record(slot: TipSlot) {
    stopPlayback();
    setError(null);
    const type =
      typeof MediaRecorder === "undefined" ? undefined : RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    if (!type || !navigator.mediaDevices) {
      setError("Recording tips needs Chrome or Safari.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Allow microphone access for this site in the browser, then try again.");
      return;
    }
    const id = slotId(slot);
    const overviewTip = id === overviewId;
    const rec = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 128_000 });
    const current = { rec, discard: false };
    const chunks: Blob[] = [];
    // Timed by the recorder's own start and stop events.
    let startedAt = 0;
    // A take stops (and saves) by itself at the limit.
    const limit = window.setTimeout(() => rec.state === "recording" && rec.stop(), TIP_MAX_SECONDS * 1000);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstart = (e) => {
      startedAt = e.timeStamp;
      // The overview opens on its first exercise: cued from the start.
      if (overviewTip) cues.current = firstExercise ? [{ at: 0, exerciseId: firstExercise }] : [];
      setNow(e.timeStamp);
      setBusy({ slot: id, phase: "recording", startedAt });
    };
    rec.onstop = async (e) => {
      window.clearTimeout(limit);
      stream.getTracks().forEach((t) => t.stop());
      const seconds = startedAt ? (e.timeStamp - startedAt) / 1000 : 0;
      // Left the view, or a click straight on and off: nothing to keep.
      if (current.discard || seconds < 0.5) {
        setBusy(null);
        // The overview's: back to reviewing it, ready to record again.
        if (overviewTip) {
          setCueNow(firstExercise);
          setPreview("ready");
        }
        return;
      }
      setBusy({ slot: id, phase: "saving", startedAt });
      const workoutId = await ensureSaved();
      if (!workoutId) {
        setBusy(null);
        if (overviewTip) setPreview(null);
        return; // the builder shows why it couldn't save
      }
      const audio = new Blob(chunks, { type: "audio/mp4" });
      // Where the speech is, so the dead air either side is skipped, and its voice levels.
      const reading = await readRecording(await audio.arrayBuffer()).catch(() => null);
      const fd = new FormData();
      fd.set("workoutId", workoutId);
      fd.set("seconds", String(reading?.duration ?? seconds));
      fd.set("audio", audio, "tip.m4a");
      const res = await uploadWorkoutTip(fd).catch(() => ({ tip: undefined, error: "Couldn’t reach the server. Try again." }));
      setBusy(null);
      if (overviewTip) setPreview(null);
      if (res.tip) {
        const tip = reading ? withReading(res.tip, reading) : res.tip;
        onTip(slot, overviewTip && cues.current.length ? { ...tip, cues: cues.current } : tip);
      } else setError(res.error ?? "The recording didn’t save. Try again.");
    };
    recorder.current = current;
    if (overviewTip) {
      cues.current = [];
      setCueNow(firstExercise);
      setPreview("record");
    }
    setBusy({ slot: id, phase: "recording", startedAt: null });
    rec.start();
  }

  function stopRecording() {
    const rec = recorder.current?.rec;
    if (rec?.state === "recording") rec.stop();
  }

  /**
   * Record (or Redo) on a row. The workout overview's opens the overview
   * first, to review the sequence; its own Record button starts the take.
   */
  function recordFor(slot: TipSlot) {
    if (slotId(slot) !== overviewId) {
      record(slot);
      return;
    }
    stopPlayback();
    setError(null);
    setCueNow(firstExercise);
    setPreview("ready");
  }

  /** Recording the overview's tip, a take thrown away: nothing's saved. */
  function cancelRecording() {
    const current = recorder.current;
    if (current?.rec.state !== "recording") return;
    current.discard = true;
    current.rec.stop();
  }

  /**
   * Recording the overview's tip: the exercise tapped is the one being talked
   * about from the tap on. `tappedAt` is the tap event's timeStamp — the same
   * clock as the recorder's start event's.
   */
  function cue(exerciseId: string, tappedAt: number) {
    if (busy?.slot !== overviewId || busy.phase !== "recording" || busy.startedAt === null) return;
    const at = Math.round(Math.max(0, (tappedAt - busy.startedAt) / 1000) * 100) / 100;
    cues.current = [...cues.current, { at, exerciseId }];
    setCueNow(exerciseId);
  }

  // The workout's blocks, each with the steps it makes (a block's steps are together).
  const groups: Array<{ block: number; steps: WorkoutStep[] }> = [];
  for (const s of steps) {
    const last = groups[groups.length - 1];
    if (last?.block === s.block) last.steps.push(s);
    else groups.push({ block: s.block, steps: [s] });
  }

  const name = (id: string) => byId.get(id)?.name ?? "Missing exercise";

  // Recording the overview's tip: the seconds before it stops by itself.
  const overviewLeft =
    busy?.slot === overviewId && busy.phase === "recording" && busy.startedAt !== null
      ? Math.max(0, TIP_MAX_SECONDS - (now - busy.startedAt) / 1000)
      : null;

  function labelFor(s: WorkoutStep): string {
    if (s.kind === "rest") {
      const what = s.reason === "round" ? "Rest between rounds" : s.reason === "side" ? "Rest between sides" : "Rest";
      return `${what} · ${formatDuration(s.seconds)}`;
    }
    const side = s.side ? cap(s.side) : null;
    if (s.groupLabel) {
      return [`Round ${s.round}`, `${String.fromCharCode(65 + s.move)} ${name(s.exerciseId)}`, side].filter(Boolean).join(" · ");
    }
    return [s.rounds > 1 ? `Set ${s.round}` : null, side].filter(Boolean).join(" · ") || "Set";
  }

  function row(s: Entry, label: string, muted = false) {
    const id = slotId(s.tipSlot);
    const mine = busy?.slot === id ? busy : null;
    const over = s.tip ? Math.ceil(s.tip.seconds - s.room) : 0;
    const btn = "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition disabled:opacity-40";
    return (
      <li key={id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
        <span className={`min-w-0 flex-1 truncate text-sm ${muted ? "text-zinc-500" : "font-medium"}`}>{label}</span>
        {over > 0 && !mine && <span className="text-xs text-amber-700">Runs {over} s past the end</span>}
        {mine?.phase === "recording" ? (
          <button type="button" onClick={stopRecording} className={`${btn} border-red-600 bg-red-600 text-white`}>
            <span className="size-2 animate-pulse rounded-sm bg-white" />
            Stop · {formatDuration(mine.startedAt === null ? 0 : (now - mine.startedAt) / 1000)}
          </button>
        ) : mine?.phase === "saving" ? (
          <span className="flex h-8 items-center px-2.5 text-xs font-medium text-zinc-500">Saving…</span>
        ) : s.tip ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => play(s.tip!, id)}
              aria-label={playing === id ? "Stop" : "Play tip"}
              className={`${btn} border-zinc-300 tabular-nums hover:bg-zinc-50`}
            >
              {playing === id ? "■" : "▶"} {formatDuration(s.tip.seconds)}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => recordFor(s.tipSlot)}
              className={`${btn} border-transparent text-zinc-600 hover:bg-zinc-100`}
            >
              Redo
            </button>
            <button
              type="button"
              aria-label="Remove tip"
              disabled={!!busy}
              onClick={() => {
                if (playing === id) stopPlayback();
                onTip(s.tipSlot, null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30"
            >
              ×
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => recordFor(s.tipSlot)}
            className={`${btn} border-zinc-300 text-zinc-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700`}
          >
            <span className="size-2 rounded-full bg-red-500" />
            Record
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Members hear a tip {TIP_DELAY_SECONDS.set} s into its set, once the exercise starts, or {TIP_DELAY_SECONDS.rest} s
        into its rest, with {instructorName ? `${instructorName}’s` : "the instructor’s"} photo on screen. It stops when the
        set or rest ends, and doesn’t play with instructor audio off. The silence before and after each recording is
        trimmed off. Save the workout to keep new recordings.
      </p>
      {/* The workout overview: after the intro, the exercise list over each one's loop while this plays. */}
      <div className="rounded-xl border border-zinc-200 px-3 pt-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-semibold">Workout overview</span>
          <span className="shrink-0 text-xs text-zinc-500">After the intro</span>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">
          Plays straight away over the exercise list; the section lasts as long as it, plus {RUNDOWN.afterTip} s. No
          tip, no overview. Record opens the overview to review the sequence; its own Record starts the take — tap each
          exercise as you start talking about it, and members’ overview follows along (▶ plays it back that way).
          Mistimed? Redo it.
        </p>
        <ul>{row(overview, "Talk members through the workout")}</ul>
      </div>
      {unsaved && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
          <span>Tips changed — save the workout to keep them.</span>
          <button
            type="button"
            disabled={saving || !!busy}
            onClick={async () => {
              setSaving(true);
              await onSave();
              setSaving(false);
            }}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {groups.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
          Add exercises in Edit first — every set and rest gets a place for a tip here.
        </p>
      ) : (
        <ol className="space-y-2">
          {groups.map((g) => {
            const b = blocks[g.block];
            if (b.kind === "rest") {
              return (
                <li key={g.block} className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3">
                  <ul>{row(entry(g.steps[0]), labelFor(g.steps[0]))}</ul>
                </li>
              );
            }
            const title =
              b.kind === "exercise"
                ? `${name(b.move.exerciseId)}${b.sets > 1 ? ` · ${b.sets} sets` : ""}`
                : `${labels[g.block]} · ${b.rounds} ${b.rounds === 1 ? "round" : "rounds"}`;
            const recorded = g.steps.filter((s) => s.tip).length;
            return (
              <li key={g.block} className="rounded-xl border border-zinc-200 px-3 pt-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {recorded} of {g.steps.length}
                  </span>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {g.steps.map((s) => row(entry(s), labelFor(s), s.kind === "rest"))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
      {(preview === "ready" || preview === "record") && (
        <OverviewPreview
          blocks={blocks}
          byId={byId}
          estimates={estimates}
          exerciseId={cueNow}
          // Reviewing, a tap just shows that exercise; recording, it's a cue.
          onPick={preview === "ready" ? (exerciseId) => setCueNow(exerciseId) : busy?.phase === "recording" ? cue : undefined}
          caption={
            error ??
            (preview === "ready"
              ? "Review the sequence — tap an exercise to see it. Then Record, and tap each exercise as you start talking about it."
              : busy?.phase === "saving"
                ? "Saving the recording…"
                : overviewLeft !== null && overviewLeft <= 20
                  ? `${Math.ceil(overviewLeft)} s left — it stops and saves by itself at ${formatDuration(TIP_MAX_SECONDS)}.`
                  : `Recording — tap each exercise as you start talking about it. Up to ${TIP_MAX_SECONDS / 60} minutes.`)
          }
          controls={
            preview === "ready" ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="flex h-[58px] flex-1 items-center justify-center rounded-full bg-white/[0.14] text-[17px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => record(RUNDOWN_TIP_SLOT)}
                  disabled={!!busy}
                  className="flex h-[58px] flex-[1.4] items-center justify-center gap-2.5 rounded-full bg-red-600 text-[17px] font-semibold disabled:opacity-60"
                >
                  <span className="size-2.5 rounded-full bg-white" />
                  Record
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelRecording}
                  disabled={busy?.phase !== "recording"}
                  className="flex h-[58px] flex-1 items-center justify-center rounded-full bg-white/[0.14] text-[17px] font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={busy?.phase !== "recording" || busy.startedAt === null}
                  className="flex h-[58px] flex-[1.4] items-center justify-center gap-2.5 rounded-full bg-red-600 text-[17px] font-semibold tabular-nums disabled:opacity-60"
                >
                  {busy?.phase === "saving" ? (
                    "Saving…"
                  ) : (
                    <>
                      <span className="size-2.5 animate-pulse rounded-sm bg-white" />
                      Stop · {formatDuration(busy?.startedAt == null ? 0 : (now - busy.startedAt) / 1000)}
                    </>
                  )}
                </button>
              </div>
            )
          }
        />
      )}
      {preview === "play" && (
        <OverviewPreview
          blocks={blocks}
          byId={byId}
          estimates={estimates}
          exerciseId={cueNow}
          caption="Playing back — the overview follows your taps, as members will see it."
          controls={
            <button
              type="button"
              onClick={stopPlayback}
              className="flex h-[58px] w-full items-center justify-center gap-2.5 rounded-full bg-white/[0.14] text-[17px] font-semibold tabular-nums"
            >
              ■ Stop · {formatDuration(playTime)}
            </button>
          }
        />
      )}
    </div>
  );
}
