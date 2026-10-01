"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createUpload } from "@mux/upchunk";
import {
  discardWorkoutVideo,
  finishWorkoutVideoUpload,
  removeWorkoutVideo,
  startWorkoutVideoUpload,
} from "@/app/actions/workouts";
import { formatDuration, mp4Url, slotFor, thumbnailUrl } from "@/lib/exercises/shared";
import type { WorkoutVideo, WorkoutVideoRole } from "@/lib/workouts/shared";
import { Flag } from "@/components/admin/exercises/ui";

/** A file picked here, on its way to Mux. */
interface LocalUpload {
  file: File;
  phase: "uploading" | "failed";
  progress: number;
  error?: string;
  videoId?: string;
  abort?: () => void;
}

/**
 * The workout's own intro or outro, in the builder's sequence: optional, one
 * clip each. Uploads straight away — saving a new workout first, so the clip
 * has somewhere to go — and a replacement keeps the current clip live until
 * it's ready. The builder re-checks clips that are still processing.
 */
export function WorkoutVideoField({
  role,
  label,
  hint,
  videos,
  ensureSaved,
  onChanged,
}: {
  role: WorkoutVideoRole;
  label: string;
  hint: string;
  /** The workout's intro and outro clips (this field picks its own). */
  videos: WorkoutVideo[];
  /** The workout's id, saving it first if it's new; null if that failed. */
  ensureSaved: () => Promise<string | null>;
  /** Something changed on the server: fetch the clips again (and, for a new workout, open its page). */
  onChanged: (workoutId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<LocalUpload | null>(null);
  const { current, pending } = slotFor(videos, role);

  async function upload(file: File) {
    setLocal({ file, phase: "uploading", progress: 0 });
    const workoutId = await ensureSaved();
    if (!workoutId) {
      setLocal(null);
      return;
    }
    const res = await startWorkoutVideoUpload({ workoutId, role, filename: file.name });
    if (res.error || !res.url || !res.videoId) {
      setLocal({ file, phase: "failed", progress: 0, error: res.error ?? "Couldn't start the upload." });
      return;
    }
    const videoId = res.videoId;
    const chunked = createUpload({ endpoint: res.url, file });
    setLocal({ file, phase: "uploading", progress: 0, videoId, abort: () => chunked.abort() });
    chunked.on("progress", (e) => {
      const progress = Math.round((e.detail as number) ?? 0);
      setLocal((prev) => (prev?.phase === "uploading" ? { ...prev, progress } : prev));
    });
    chunked.on("success", async () => {
      await finishWorkoutVideoUpload(videoId);
      setLocal(null);
      onChanged(workoutId);
    });
    chunked.on("error", async (e) => {
      await discardWorkoutVideo(videoId);
      const message = (e.detail && (e.detail.message as string)) || "Upload failed.";
      setLocal({ file, phase: "failed", progress: 0, error: message });
      onChanged(workoutId);
    });
  }

  async function cancel() {
    const videoId = local?.videoId;
    local?.abort?.();
    setLocal(null);
    const workoutId = await ensureSaved();
    if (!workoutId) return;
    if (videoId) await discardWorkoutVideo(videoId);
    onChanged(workoutId);
  }

  async function clear(videoId: string) {
    const workoutId = await ensureSaved();
    if (!workoutId) return;
    await discardWorkoutVideo(videoId);
    onChanged(workoutId);
  }

  async function remove() {
    if (!window.confirm(`Remove the ${label.toLowerCase()} video from this workout?`)) return;
    const workoutId = await ensureSaved();
    if (!workoutId) return;
    await removeWorkoutVideo(workoutId, role);
    onChanged(workoutId);
  }

  const uploading = local?.phase === "uploading";
  const processing = !uploading && !!pending && pending.status !== "errored";
  const busy = uploading || processing;

  let status: string;
  if (uploading) status = `Uploading · ${local.progress}%`;
  else if (local?.phase === "failed") status = local.error ?? "Upload failed";
  else if (pending?.status === "errored") status = pending.error ?? "Processing failed";
  else if (processing) status = current ? "Replacing · processing" : "Processing";
  else if (current) status = `${formatDuration(current.durationSeconds)} · ${current.originalFilename ?? "Ready"}`;
  else status = hint;
  const failed = local?.phase === "failed" || pending?.status === "errored";
  const url = current ? mp4Url(current) : null;
  const linkBtn = "text-xs font-semibold text-zinc-600 hover:underline";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
      <Flag>{label}</Flag>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={current ? `Replace the ${label.toLowerCase()} video` : `Choose an ${label.toLowerCase()} video`}
        className="relative h-14 w-8 shrink-0 overflow-hidden rounded border border-dashed border-zinc-300 bg-white disabled:cursor-default"
      >
        {current?.playbackId && (
          <Image
            src={thumbnailUrl(current.playbackId, 64, 112)}
            alt=""
            fill
            unoptimized
            className={`object-cover ${busy ? "opacity-40" : ""}`}
          />
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      <div className="min-w-40 flex-1 space-y-1">
        <p className={`truncate text-sm ${failed ? "text-red-600" : current || busy ? "text-zinc-800" : "text-zinc-500"}`}>
          {status}
        </p>
        {uploading && (
          <span className="block h-1 max-w-48 overflow-hidden rounded bg-zinc-200">
            <span className="block h-1 bg-zinc-900" style={{ width: `${local.progress}%` }} />
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {uploading ? (
          <button type="button" onClick={cancel} className={linkBtn}>
            Cancel
          </button>
        ) : processing ? null : (
          <>
            {pending?.status === "errored" && (
              <button type="button" onClick={() => clear(pending.id)} className={linkBtn}>
                Clear
              </button>
            )}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" className={linkBtn}>
                Watch ↗
              </a>
            )}
            {current && (
              <button type="button" onClick={remove} className="text-xs font-semibold text-red-600 hover:underline">
                Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-zinc-50"
            >
              {current ? "Replace" : "Upload video"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
