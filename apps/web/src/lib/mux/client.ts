import "server-only";

import Mux from "@mux/mux-node";

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export interface MuxAssetSummary {
  assetId: string;
  playbackId: string | null;
  durationSeconds: number | null;
  createdAtISO: string;
  title: string | null;
  status: "preparing" | "ready" | "errored";
  ingestType: string | null;
  liveStreamId: string | null;
  isLiveRecording: boolean;
  liveStreamActive: boolean;
  liveRecordingFinalized: boolean;
}

export type MuxMasterDownloadStatus =
  | "not_requested"
  | "preparing"
  | "ready"
  | "errored"
  | "unavailable";

export interface MuxMasterDownloadInfo {
  status: MuxMasterDownloadStatus;
  url: string | null;
}

export function masterDownloadInfo(
  master: { status?: "ready" | "preparing" | "errored"; url?: string } | null | undefined,
): MuxMasterDownloadInfo {
  if (!master?.status) return { status: "not_requested", url: null };
  return {
    status: master.status,
    url: master.status === "ready" ? (master.url ?? null) : null,
  };
}

type MuxAssetLike = {
  id: string;
  created_at: string;
  duration?: number;
  ingest_type?: string;
  is_live?: boolean;
  live_stream_id?: string;
  meta?: { title?: string };
  passthrough?: string;
  playback_ids?: Array<{ id: string; policy?: string }>;
  status: "preparing" | "ready" | "errored";
};

function isLiveRecordingAsset(asset: MuxAssetLike): boolean {
  return (
    asset.ingest_type === "live_rtmp" ||
    asset.ingest_type === "live_srt" ||
    !!asset.live_stream_id
  );
}

export function isMuxAssetImportReady(asset: MuxAssetLike): boolean {
  const isLiveRecording = isLiveRecordingAsset(asset);
  return !isLiveRecording || asset.is_live !== true;
}

function summarizeMuxAsset(asset: MuxAssetLike): MuxAssetSummary {
  const playbackIds = asset.playback_ids ?? [];
  const chosen = playbackIds.find((p) => p.policy === "public") ?? playbackIds[0];
  const isLiveRecording = isLiveRecordingAsset(asset);
  const liveStreamActive = isLiveRecording && asset.is_live === true;

  return {
    assetId: asset.id,
    playbackId: chosen?.id ?? null,
    durationSeconds: asset.duration ?? null,
    createdAtISO: new Date(Number(asset.created_at) * 1000).toISOString(),
    title: asset.meta?.title ?? asset.passthrough ?? null,
    status: asset.status,
    ingestType: asset.ingest_type ?? null,
    liveStreamId: asset.live_stream_id ?? null,
    isLiveRecording,
    liveStreamActive,
    liveRecordingFinalized: !isLiveRecording || !liveStreamActive,
  };
}

/**
 * List every asset in the Mux account (auto-paginated), normalized for the
 * "Sync from Mux" import UI. Prefers a public playback id.
 */
export async function listMuxAssets(): Promise<MuxAssetSummary[]> {
  const out: MuxAssetSummary[] = [];
  for await (const asset of mux.video.assets.list({ limit: 100 })) {
    out.push(summarizeMuxAsset(asset));
  }
  return out;
}

export async function getMuxAssetSummary(
  assetId: string,
): Promise<MuxAssetSummary | null> {
  try {
    const asset = await mux.video.assets.retrieve(assetId);
    return summarizeMuxAsset(asset);
  } catch {
    return null;
  }
}

/**
 * Current processing status of a single Mux asset, or null if it can't be
 * fetched. Used to gate the "delete raw recording" action on a trimmed clip
 * having finished encoding.
 */
export async function getAssetStatus(
  assetId: string,
): Promise<"preparing" | "ready" | "errored" | null> {
  try {
    const asset = await mux.video.assets.retrieve(assetId);
    return asset.status;
  } catch {
    return null;
  }
}

/**
 * Temporary master MP4 download status for an asset. Mux only exposes this
 * object after master access is requested, and removes it after the URL expires.
 */
export async function getAssetMasterDownload(
  assetId: string,
): Promise<MuxMasterDownloadInfo> {
  try {
    const asset = await mux.video.assets.retrieve(assetId);
    return masterDownloadInfo(asset.master);
  } catch {
    return { status: "unavailable", url: null };
  }
}
