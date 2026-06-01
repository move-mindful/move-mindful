"use client";

import MuxPlayerComponent from "@mux/mux-player-react";

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
    />
  );
}
