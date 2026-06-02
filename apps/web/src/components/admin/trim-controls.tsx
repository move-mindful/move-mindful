"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const MuxPlayerComponent = dynamic(
  () => import("@mux/mux-player-react").then((mod) => mod.default),
  { ssr: false },
);

function fmt(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}:${String(rem).padStart(2, "0")}`;
}

/**
 * Plays the RAW (untrimmed) recording and lets an admin mark the start/end of
 * the clip. Submits `sourceAssetId`, `startSeconds`, `endSeconds` as hidden
 * fields alongside the rest of the class form. We track the player's
 * `currentTime` via `onTimeUpdate` (fires on play and on seek) rather than an
 * imperative ref, which is more robust with the dynamically-loaded player.
 */
export function TrimControls({
  playbackId,
  sourceAssetId,
  durationSeconds,
}: {
  playbackId: string;
  sourceAssetId: string;
  durationSeconds: number;
}) {
  const max = durationSeconds > 0 ? durationSeconds : undefined;
  const [currentTime, setCurrentTime] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(durationSeconds || 0);

  const length = Math.max(0, end - start);
  const valid = end > start && length >= 0.5;

  return (
    <div className="space-y-3">
      <MuxPlayerComponent
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#18181b"
        style={{ display: "block", aspectRatio: "16/9", width: "100%", maxWidth: "100%" }}
        playsInline
        onTimeUpdate={(evt) => {
          const el = evt.target as (HTMLMediaElement & { currentTime: number }) | null;
          if (el) setCurrentTime(el.currentTime);
        }}
      />

      <input type="hidden" name="sourceAssetId" value={sourceAssetId} />
      <input type="hidden" name="startSeconds" value={start} />
      <input type="hidden" name="endSeconds" value={end} />

      <p className="text-xs text-zinc-400">
        Playhead: {fmt(currentTime)} — scrub the video, then mark the start and end.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setStart(Math.min(currentTime, end))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-50"
        >
          Set start to playhead
        </button>
        <span className="text-sm text-zinc-600">Start: {fmt(start)}</span>
        <button
          type="button"
          onClick={() => setEnd(max ? Math.min(Math.max(currentTime, start), max) : Math.max(currentTime, start))}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-50"
        >
          Set end to playhead
        </button>
        <span className="text-sm text-zinc-600">End: {fmt(end)}</span>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="text-xs text-zinc-500">
          Start (s)
          <input
            type="number"
            min={0}
            max={max}
            step="0.1"
            value={start}
            onChange={(e) => setStart(Math.max(0, Number(e.target.value)))}
            className="mt-1 block w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-500">
          End (s)
          <input
            type="number"
            min={0}
            max={max}
            step="0.1"
            value={end}
            onChange={(e) => setEnd(Math.max(0, Number(e.target.value)))}
            className="mt-1 block w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <p className={`text-sm ${valid ? "text-zinc-600" : "text-red-600"}`}>
        Clip length: {fmt(length)} (~{Math.max(1, Math.round(length / 60))} min)
        {!valid && " — set an end at least half a second after the start"}
      </p>
    </div>
  );
}
