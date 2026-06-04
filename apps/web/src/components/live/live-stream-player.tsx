"use client";

import { useEffect, useState } from "react";
import { MuxPlayer } from "@/components/mux-player";
import { LiveOfflineOverlay } from "@/components/live/live-offline-overlay";

const OFFLINE_POLL_MS = 5_000;
const LIVE_POLL_MS = 15_000;

async function checkLiveStatus(signal: AbortSignal): Promise<boolean> {
  const response = await fetch("/api/live/status", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) return false;

  const data = (await response.json()) as { isLive?: unknown };
  return data.isLive === true;
}

function WaitingForLiveStream() {
  return (
    <div className="relative aspect-video w-full bg-black">
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <LiveOfflineOverlay />
      </div>
    </div>
  );
}

export function LiveStreamPlayer({ playbackId }: { playbackId: string }) {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    async function updateLiveStatus() {
      if (inFlight) return;
      inFlight = true;

      try {
        setIsLive(await checkLiveStatus(controller.signal));
      } catch {
        if (!controller.signal.aborted) {
          setIsLive(false);
        }
      } finally {
        inFlight = false;
      }
    }

    updateLiveStatus();
    const id = window.setInterval(
      updateLiveStatus,
      isLive ? LIVE_POLL_MS : OFFLINE_POLL_MS,
    );

    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [isLive]);

  if (!isLive) return <WaitingForLiveStream />;

  return (
    <MuxPlayer
      playbackId={playbackId}
      title="Move Mindful Live"
      streamType="live"
      fillVideo
      liveOfflineOverlay
      offlineOverlay={<LiveOfflineOverlay />}
      autoPlay="muted"
      muted
    />
  );
}
