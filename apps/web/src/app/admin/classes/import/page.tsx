import Link from "next/link";
import Image from "next/image";
import { listMuxAssets } from "@/lib/mux/client";
import { getAdminClasses } from "@/lib/admin/queries";
import { DeleteMuxAssetButton } from "@/components/admin/delete-mux-asset-button";

export const dynamic = "force-dynamic";

export default async function ImportFromMuxPage() {
  let assets: Awaited<ReturnType<typeof listMuxAssets>> = [];
  let error: string | null = null;
  try {
    assets = await listMuxAssets();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to reach Mux.";
  }

  const classes = await getAdminClasses();
  const usedAssetIds = new Set(classes.map((c) => c.muxAssetId).filter(Boolean));
  const usedPlaybackIds = new Set(classes.map((c) => c.muxPlaybackId).filter(Boolean));
  // Raw recordings that have already been trimmed into a clip — don't re-offer
  // them for import (the published class points at the clip, not the raw asset).
  const sourceAssetIds = new Set(classes.map((c) => c.sourceMuxAssetId).filter(Boolean));

  // A class predating sync has a playback id but no asset id — match on both so it
  // is not re-surfaced as new.
  const newAssets = assets.filter(
    (a) =>
      a.status === "ready" &&
      a.playbackId &&
      !usedAssetIds.has(a.assetId) &&
      !sourceAssetIds.has(a.assetId) &&
      !usedPlaybackIds.has(a.playbackId),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Classes
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import</h1>
          <p className="mt-1 text-zinc-500">
            {newAssets.length} new video{newAssets.length !== 1 && "s"} found
          </p>
        </div>
        <Link
          href="/admin/classes/import"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
        >
          Refresh
        </Link>
      </div>

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not reach Mux: {error}
        </p>
      )}

      {!error && newAssets.length === 0 && (
        <p className="mt-10 text-zinc-500">
          No new videos. Upload to Mux, then hit Refresh.
        </p>
      )}

      {newAssets.length > 0 && (
        <div className="mt-8 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {newAssets.map((a) => {
            const importReady = a.liveRecordingFinalized;
            const minutes = a.durationSeconds
              ? Math.max(1, Math.round(a.durationSeconds / 60))
              : "";
            const params = new URLSearchParams({
              assetId: a.assetId,
              playbackId: a.playbackId ?? "",
              duration: String(minutes),
              title: a.title ?? "",
            });
            const trimParams = new URLSearchParams({
              assetId: a.assetId,
              playbackId: a.playbackId ?? "",
              durationSeconds: String(a.durationSeconds ?? ""),
              title: a.title ?? "",
            });
            return (
              <div
                key={a.assetId}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-zinc-100">
                  {a.playbackId && (
                    <Image
                      src={`https://image.mux.com/${a.playbackId}/thumbnail.webp?width=240&height=140&fit_mode=smartcrop`}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-medium">
                      {a.title ?? "Untitled asset"}
                    </p>
                    {a.isLiveRecording && !importReady && (
                      <span
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        title="Mux has made the recording playable, but its final duration is still settling."
                      >
                        Finalizing recording
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-zinc-500">
                    {minutes ? `${minutes} min · ` : ""}
                    {new Date(a.createdAtISO).toLocaleDateString()}
                  </p>
                  {a.isLiveRecording && !importReady && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Wait for Mux to finish the live recording, then refresh before
                      trimming or importing.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                  {importReady ? (
                    <>
                      <Link
                        href={`/admin/classes/new?${params.toString()}`}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                      >
                        Import
                      </Link>
                      <Link
                        href={`/admin/classes/trim?${trimParams.toString()}`}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-50"
                      >
                        Trim &amp; import
                      </Link>
                      <DeleteMuxAssetButton assetId={a.assetId} title={a.title ?? ""} />
                    </>
                  ) : (
                    <>
                      <span
                        aria-disabled="true"
                        className="rounded-lg bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-500"
                      >
                        Import
                      </span>
                      <span
                        aria-disabled="true"
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-400"
                      >
                        Trim &amp; import
                      </span>
                      <span className="text-sm font-medium text-zinc-400">Delete</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
