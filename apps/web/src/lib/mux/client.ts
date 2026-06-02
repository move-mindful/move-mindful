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
}

/**
 * List every asset in the Mux account (auto-paginated), normalized for the
 * "Sync from Mux" import UI. Prefers a public playback id.
 */
export async function listMuxAssets(): Promise<MuxAssetSummary[]> {
  const out: MuxAssetSummary[] = [];
  for await (const asset of mux.video.assets.list({ limit: 100 })) {
    const playbackIds = asset.playback_ids ?? [];
    const chosen = playbackIds.find((p) => p.policy === "public") ?? playbackIds[0];
    out.push({
      assetId: asset.id,
      playbackId: chosen?.id ?? null,
      durationSeconds: asset.duration ?? null,
      createdAtISO: new Date(Number(asset.created_at) * 1000).toISOString(),
      title: asset.meta?.title ?? asset.passthrough ?? null,
      status: asset.status,
    });
  }
  return out;
}
