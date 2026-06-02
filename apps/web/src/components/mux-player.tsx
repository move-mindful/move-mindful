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
  const backgroundColor = streamType === "live" ? "#000" : "#fff";

  return (
    <div
      className="flex aspect-video w-full overflow-hidden"
      style={{ backgroundColor }}
    >
      <MuxPlayerComponent
        playbackId={playbackId}
        streamType={streamType}
        accentColor="#18181b"
        metadata={{ video_title: title }}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          "--media-background-color": backgroundColor,
        }}
        playsInline
        defaultHiddenCaptions
      />
    </div>
  );
}
