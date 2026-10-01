"use client";

import { useEffect, useRef, useState } from "react";
import {
  groupLabels,
  workoutSteps,
  type AudioTip,
  type EstimateExercise,
  type TipSlot,
  type WorkoutBlock,
  type WorkoutStep,
} from "@move-mindful/core";
import { uploadWorkoutTip } from "@/app/actions/workouts";
import { formatDuration } from "@/lib/exercises/shared";
import { TIP_DELAY_SECONDS, TIP_MAX_SECONDS, tipUrl, type CatalogExercise } from "@/lib/workouts/shared";

// The builder's "Audio tips" view: the workout as members walk it — every set
// (each side of a sided one) and every rest, the ones the builder adds between
// sets and rounds included — each with a tip to record from the microphone,
// play back, redo or remove. Recordings upload straight away; the sequence
// points at them once the workout is saved (see uploadWorkoutTip).

// What the browser records in: AAC in MP4 (Chrome, Safari), which every
// phone and browser can play. Firefox only records Opus, so it can't record tips.
const RECORD_TYPES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"];

const slotId = (s: TipSlot) => `${s.block}/${s.move ?? "-"}/${s.key}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A slot being recorded (`startedAt` once the recorder has started, on the page's clock) or saved. */
type Busy = { slot: string; phase: "recording" | "saving"; startedAt: number | null } | null;

export function TipsView({
  blocks,
  estimates,
  byId,
  instructorName,
  ensureSaved,
  onTip,
}: {
  blocks: WorkoutBlock[];
  estimates: Record<string, EstimateExercise>;
  byId: Map<string, CatalogExercise>;
  /** The workout's instructor, for the explanation at the top. */
  instructorName: string | null;
  /** The workout's id, saving it first if it's new — a recording needs somewhere to go. */
  ensureSaved: () => Promise<string | null>;
  onTip: (slot: TipSlot, tip: AudioTip | null) => void;
}) {
  const steps = workoutSteps(blocks, estimates);
  const labels = groupLabels(blocks);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const recorder = useRef<{ rec: MediaRecorder; discard: boolean } | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

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
  }

  function play(tip: AudioTip, id: string) {
    if (playing === id) {
      stopPlayback();
      return;
    }
    const el = (player.current ??= new Audio());
    el.onended = () => setPlaying(null);
    el.src = tipUrl(tip.id);
    setPlaying(id);
    el.play().catch(() => {
      setPlaying(null);
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
    const rec = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 128_000 });
    const current = { rec, discard: false };
    const chunks: Blob[] = [];
    // Timed by the recorder's own start and stop events.
    let startedAt = 0;
    const limit = window.setTimeout(() => rec.state === "recording" && rec.stop(), TIP_MAX_SECONDS * 1000);
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstart = (e) => {
      startedAt = e.timeStamp;
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
        return;
      }
      setBusy({ slot: id, phase: "saving", startedAt });
      const workoutId = await ensureSaved();
      if (!workoutId) {
        setBusy(null);
        return; // the builder shows why it couldn't save
      }
      const fd = new FormData();
      fd.set("workoutId", workoutId);
      fd.set("seconds", String(seconds));
      fd.set("audio", new Blob(chunks, { type: "audio/mp4" }), "tip.m4a");
      const res = await uploadWorkoutTip(fd).catch(() => ({ tip: undefined, error: "Couldn’t reach the server. Try again." }));
      setBusy(null);
      if (res.tip) onTip(slot, res.tip);
      else setError(res.error ?? "The recording didn’t save. Try again.");
    };
    recorder.current = current;
    setBusy({ slot: id, phase: "recording", startedAt: null });
    rec.start();
  }

  function stopRecording() {
    const rec = recorder.current?.rec;
    if (rec?.state === "recording") rec.stop();
  }

  // The workout's blocks, each with the steps it makes (a block's steps are together).
  const groups: Array<{ block: number; steps: WorkoutStep[] }> = [];
  for (const s of steps) {
    const last = groups[groups.length - 1];
    if (last?.block === s.block) last.steps.push(s);
    else groups.push({ block: s.block, steps: [s] });
  }

  const name = (id: string) => byId.get(id)?.name ?? "Missing exercise";

  function labelFor(s: WorkoutStep): string {
    if (s.kind === "rest") return `${s.reason === "round" ? "Rest between rounds" : "Rest"} · ${formatDuration(s.seconds)}`;
    const side = s.side ? cap(s.side) : null;
    if (s.groupLabel) {
      return [`Round ${s.round}`, `${String.fromCharCode(65 + s.move)} ${name(s.exerciseId)}`, side].filter(Boolean).join(" · ");
    }
    return [s.rounds > 1 ? `Set ${s.round}` : null, side].filter(Boolean).join(" · ") || "Set";
  }

  /** Seconds between the tip starting and its set or rest ending (for a rep set, the reps at the clip's pace). */
  function room(s: WorkoutStep): number {
    if (s.kind === "rest") return s.seconds - TIP_DELAY_SECONDS.rest;
    return (s.measure === "time" ? s.amount : s.workSeconds) - TIP_DELAY_SECONDS.set;
  }

  function row(s: WorkoutStep, label: string, muted = false) {
    const id = slotId(s.tipSlot);
    const mine = busy?.slot === id ? busy : null;
    const over = s.tip ? Math.ceil(s.tip.seconds - room(s)) : 0;
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
              onClick={() => record(s.tipSlot)}
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
            onClick={() => record(s.tipSlot)}
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
        set or rest ends, and doesn’t play with instructor audio off. Save the workout to keep new recordings.
      </p>
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
                  <ul>{row(g.steps[0], labelFor(g.steps[0]))}</ul>
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
                  {g.steps.map((s) => row(s, labelFor(s), s.kind === "rest"))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
