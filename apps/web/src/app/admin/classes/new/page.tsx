import Link from "next/link";
import {
  getTagPickerData,
  getInstructorOptions,
  getCollectionOptions,
} from "@/lib/admin/queries";
import { getMuxAssetSummary } from "@/lib/mux/client";
import { ClassForm } from "@/components/admin/class-form";

export const dynamic = "force-dynamic";

export default async function NewClassPage({
  searchParams,
}: {
  searchParams: Promise<{
    assetId?: string;
    playbackId?: string;
    duration?: string;
    title?: string;
  }>;
}) {
  const sp = await searchParams;
  const [tagData, instructors, collections, importedAsset] = await Promise.all([
    getTagPickerData(),
    getInstructorOptions(),
    getCollectionOptions(),
    sp.assetId ? getMuxAssetSummary(sp.assetId) : Promise.resolve(null),
  ]);
  const importedDurationMinutes = importedAsset?.durationSeconds
    ? Math.max(1, Math.round(importedAsset.durationSeconds / 60))
    : sp.duration;
  const importIsBlocked =
    sp.assetId &&
    (!importedAsset ||
      importedAsset.status !== "ready" ||
      !importedAsset.playbackId ||
      (importedAsset.isLiveRecording && !importedAsset.liveRecordingFinalized));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Back
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">New class</h1>
      {sp.assetId && (
        <p className="mt-1 text-sm text-zinc-500">
          Imported from Mux — fill in the details below.
        </p>
      )}

      {importIsBlocked ? (
        <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This Mux asset is not ready to import yet. If it is a live recording, wait
          for Mux to finish finalizing the recording, then refresh Import.
        </p>
      ) : (
        <div className="mt-8">
          <ClassForm
            mode="create"
            tagData={tagData}
            instructors={instructors}
            collections={collections}
            initial={{
              muxAssetId: sp.assetId,
              muxPlaybackId: importedAsset?.playbackId ?? sp.playbackId,
              durationMinutes: importedDurationMinutes,
              title: importedAsset?.title ?? sp.title,
            }}
          />
        </div>
      )}
    </div>
  );
}
