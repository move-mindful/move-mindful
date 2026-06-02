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
    <div
      className="relative aspect-video w-full overflow-hidden"
      style={{ backgroundColor: streamType === "live" ? "#000" : "#fff" }}
    >
      <MuxPlayerComponent
        playbackId={playbackId}
        streamType={streamType}
        accentColor="#18181b"
        metadata={{ video_title: title }}
        style={{
          position: "absolute",
          inset: "-1px",
          display: "block",
          width: "calc(100% + 2px)",
          height: "calc(100% + 2px)",
          maxWidth: "none",
        }}
        playsInline
        defaultHiddenCaptions
      />
    </div>
  );
}
