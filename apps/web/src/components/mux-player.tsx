"use client";

import dynamic from "next/dynamic";

const MuxPlayerComponent = dynamic(
  () => import("@mux/mux-player-react").then((mod) => mod.default),
  { ssr: false },
);

export function MuxPlayer({
  playbackId,
  title,
  streamType = "on-demand",
}: {
  playbackId: string;
  title: string;
  streamType?: "on-demand" | "live";
}) {
  return (
    <MuxPlayerComponent
      playbackId={playbackId}
      streamType={streamType}
      accentColor="#18181b"
      metadata={{ video_title: title }}
      style={{ display: "block", aspectRatio: "16/9", width: "100%", maxWidth: "100%" }}
      playsInline
      defaultHiddenCaptions
    />
  );
}
