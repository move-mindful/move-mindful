import Link from "next/link";
import Image from "next/image";
import { listMuxAssets } from "@/lib/mux/client";
import { getAdminClasses } from "@/lib/admin/queries";

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

  // A class predating sync has a playback id but no asset id — match on both so it
  // is not re-surfaced as new.
  const newAssets = assets.filter(
    (a) =>
      a.status === "ready" &&
      a.playbackId &&
      !usedAssetIds.has(a.assetId) &&
      !usedPlaybackIds.has(a.playbackId),
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Classes
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync from Mux</h1>
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

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {newAssets.map((a) => {
          const minutes = a.durationSeconds
            ? Math.max(1, Math.round(a.durationSeconds / 60))
            : "";
          const params = new URLSearchParams({
            assetId: a.assetId,
            playbackId: a.playbackId ?? "",
            duration: String(minutes),
            title: a.title ?? "",
          });
          return (
            <div key={a.assetId} className="overflow-hidden rounded-xl border border-zinc-200">
              <div className="relative aspect-video bg-zinc-100">
                {a.playbackId && (
                  <Image
                    src={`https://image.mux.com/${a.playbackId}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop`}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                  />
                )}
              </div>
              <div className="p-4">
                <p className="truncate text-sm font-medium">
                  {a.title ?? "Untitled asset"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {minutes ? `${minutes} min · ` : ""}
                  {new Date(a.createdAtISO).toLocaleDateString()}
                </p>
                <Link
                  href={`/admin/classes/new?${params.toString()}`}
                  className="mt-3 inline-block rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700"
                >
                  Import
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
