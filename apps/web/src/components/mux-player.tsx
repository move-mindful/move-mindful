"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

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
  offlineOverlay,
  autoPlay,
  muted,
}: {
  playbackId: string;
  title: string;
  streamType?: "on-demand" | "live";
  fillVideo?: boolean;
  liveOfflineOverlay?: boolean;
  offlineOverlay?: ReactNode;
  autoPlay?: boolean | "muted";
  muted?: boolean;
}) {
  const showLiveOverlay = liveOfflineOverlay && streamType === "live";
  const [hasLiveError, setHasLiveError] = useState(false);

  const clearLiveError = () => {
    if (showLiveOverlay) setHasLiveError(false);
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
        autoPlay={autoPlay}
        muted={muted}
        defaultHiddenCaptions
      />
    );
  }

  return (
    <div className="relative">
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
          "--dialog": "none",
        }}
        onError={() => {
          setHasLiveError(true);
        }}
        onLoadStart={clearLiveError}
        onLoadedData={clearLiveError}
        onPlaying={clearLiveError}
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        defaultHiddenCaptions
      />
      {showLiveOverlay && hasLiveError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black px-6 text-center text-white">
          {offlineOverlay ?? (
            <>
              <p className="text-2xl font-semibold">No live class right now</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300">
                Check the schedule below for upcoming classes.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
