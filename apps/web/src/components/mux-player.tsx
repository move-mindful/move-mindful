"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const MuxPlayerComponent = dynamic(
  () => import("@mux/mux-player-react").then((mod) => mod.default),
  { ssr: false },
);

export function MuxPlayer({
  playbackId,
  title,
  streamType = "on-demand",
  fillVideo = false,
  liveOfflineOverlay = false,
}: {
  playbackId: string;
  title: string;
  streamType?: "on-demand" | "live";
  fillVideo?: boolean;
  liveOfflineOverlay?: boolean;
}) {
  const showLiveOverlay = liveOfflineOverlay && streamType === "live";
  const [hasLiveError, setHasLiveError] = useState(false);
  const [playerAttempt, setPlayerAttempt] = useState(0);

  const clearLiveError = () => {
    if (showLiveOverlay) setHasLiveError(false);
  };

  const retryLivePlayback = () => {
    setHasLiveError(false);
    setPlayerAttempt((attempt) => attempt + 1);
  };

  if (!showLiveOverlay) {
    return (
      <MuxPlayerComponent
        playbackId={playbackId}
        streamType={streamType}
        accentColor="#18181b"
        metadata={{ video_title: title }}
        style={{
          display: "block",
          aspectRatio: "16/9",
          width: "100%",
          maxWidth: "100%",
          "--media-object-fit": fillVideo ? "cover" : undefined,
        }}
        playsInline
        defaultHiddenCaptions
      />
    );
  }

  return (
    <div className="relative">
      <MuxPlayerComponent
        key={playerAttempt}
        playbackId={playbackId}
        streamType={streamType}
        accentColor="#18181b"
        metadata={{ video_title: title }}
        style={{
          display: "block",
          aspectRatio: "16/9",
          width: "100%",
          maxWidth: "100%",
          "--dialog": "none",
        }}
        onError={() => {
          setHasLiveError(true);
        }}
        onLoadStart={clearLiveError}
        onLoadedData={clearLiveError}
        onPlaying={clearLiveError}
        playsInline
        defaultHiddenCaptions
      />
      {showLiveOverlay && hasLiveError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black px-6 text-center text-white">
          <p className="text-2xl font-semibold">No live class right now</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300">
            Check the schedule below for upcoming classes.
          </p>
          <button
            type="button"
            onClick={retryLivePlayback}
            className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
