"use client";

import dynamic from "next/dynamic";

const MuxPlayerComponent = dynamic(
  () => import("@mux/mux-player-react").then((mod) => mod.default),
  { ssr: false },
);

export function MuxPlayer({
  playbackId,
  title,
}: {
  playbackId: string;
  title: string;
}) {
  return (
    <MuxPlayerComponent
      playbackId={playbackId}
      streamType="on-demand"
      accentColor="#18181b"
      metadata={{ video_title: title }}
      style={{ aspectRatio: "16/9", width: "100%", maxWidth: "100%" }}
      playsInline
      defaultHiddenCaptions
    />
  );
}
