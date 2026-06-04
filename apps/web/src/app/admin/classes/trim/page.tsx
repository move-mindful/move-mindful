import Link from "next/link";
import {
  getTagPickerData,
  getInstructorOptions,
  getCollectionOptions,
} from "@/lib/admin/queries";
import { getMuxAssetSummary } from "@/lib/mux/client";
import { ClassForm } from "@/components/admin/class-form";

export const dynamic = "force-dynamic";

export default async function TrimClassPage({
  searchParams,
}: {
  searchParams: Promise<{
    assetId?: string;
    playbackId?: string;
    title?: string;
    durationSeconds?: string;
  }>;
}) {
  const sp = await searchParams;
  const [tagData, instructors, collections, sourceAsset] = await Promise.all([
    getTagPickerData(),
    getInstructorOptions(),
    getCollectionOptions(),
    sp.assetId ? getMuxAssetSummary(sp.assetId) : Promise.resolve(null),
  ]);

  const rawPlaybackId = sourceAsset?.playbackId ?? sp.playbackId;
  const rawDurationSeconds =
    sourceAsset?.durationSeconds ?? (Number(sp.durationSeconds) || 0);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/classes/import"
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        &larr; Import
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Trim &amp; import</h1>

      {!sp.assetId ? (
        <p className="mt-6 text-zinc-500">
          Open this from <span className="font-medium">Import</span> by choosing
          &ldquo;Trim &amp; import&rdquo; on a recording.
        </p>
      ) : !sourceAsset ? (
        <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not verify this Mux asset. Go back to Import and refresh before
          trimming.
        </p>
      ) : sourceAsset.status !== "ready" || !rawPlaybackId ? (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mux is still preparing this recording. Go back to Import and refresh once
          it is ready.
        </p>
      ) : sourceAsset.isLiveRecording && !sourceAsset.liveRecordingFinalized ? (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mux has made this live recording playable, but its final duration is still
          settling. Refresh Import after Mux finishes finalizing the recording.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-zinc-500">
            Scrub the original recording, mark the start and end, and publish only
            the trimmed clip. The raw recording stays in Mux until you delete it
            from the class page.
          </p>
          <div className="mt-8">
            <ClassForm
              mode="trim"
              tagData={tagData}
              instructors={instructors}
              collections={collections}
              initial={{ title: sourceAsset.title ?? sp.title }}
              trim={{
                sourceAssetId: sp.assetId,
                rawPlaybackId,
                rawDurationSeconds,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
