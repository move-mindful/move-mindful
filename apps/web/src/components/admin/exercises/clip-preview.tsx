"use client";

import { useState } from "react";
import {
  ROLE_TAB_LABELS,
  formatDuration,
  isLoopRole,
  mp4Url,
  rolesFor,
  slotFor,
  type ExerciseKind,
  type ExerciseVideo,
  type VideoRole,
} from "@/lib/exercises/shared";

/**
 * Plays an exercise's live clips the way the player will: the MP4 in a plain
 * <video>, loops muted and repeating, the tutorial and warm-up with sound and
 * controls. Tabs switch between the clips (Right loop / Left loop / Tutorial).
 */
export function ClipPreview({
  kind,
  sided,
  videos,
}: {
  kind: ExerciseKind;
  sided: boolean;
  videos: ExerciseVideo[];
}) {
  // Loops first (that's what an admin checks most), the tutorial last.
  const loops: VideoRole[] = rolesFor(kind, sided).filter((r) => r !== "tutorial");
  const roles: VideoRole[] = kind === "warmup" ? ["warmup"] : [...loops, "tutorial"];
  const [picked, setPicked] = useState<VideoRole>(roles[0]);
  const role = roles.includes(picked) ? picked : roles[0];
  const slot = slotFor(videos, role);
  const clip = slot.current;
  const url = clip ? mp4Url(clip) : null;
  const loop = isLoopRole(role);

  let message: string | null = null;
  if (!url) {
    if (slot.pending?.status === "errored") message = "The last upload failed.";
    else if (slot.pending) message = "Still processing — the preview appears once it’s ready.";
    else message = "No clip yet.";
  }

  return (
    <div className="space-y-3">
      {roles.length > 1 && (
        <div className="flex h-9 gap-0.5 rounded-lg bg-zinc-100 p-0.5">
          {roles.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === role}
              onClick={() => setPicked(r)}
              className={`flex-1 rounded-md text-sm transition ${
                r === role ? "bg-white font-semibold text-zinc-900 shadow-sm" : "font-medium text-zinc-500"
              }`}
            >
              {ROLE_TAB_LABELS[r]}
            </button>
          ))}
        </div>
      )}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[216px] overflow-hidden rounded-xl bg-zinc-200">
        {url ? (
          <video
            key={url}
            src={url}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
            preload="auto"
            {...(loop ? { autoPlay: true, muted: true, loop: true } : { controls: true })}
          />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-500">
            {message}
          </p>
        )}
        {url && clip && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-zinc-900/75 px-2 py-0.5 text-[11px] font-semibold text-white">
            {loop ? "Loop" : ROLE_TAB_LABELS[role]} · {formatDuration(clip.durationSeconds)}
          </span>
        )}
      </div>
    </div>
  );
}
