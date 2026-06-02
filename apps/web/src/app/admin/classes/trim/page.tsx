import Link from "next/link";
import { getTagPickerData, getInstructorOptions } from "@/lib/admin/queries";
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
  const [tagData, instructors] = await Promise.all([
    getTagPickerData(),
    getInstructorOptions(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/classes/import"
        className="text-sm text-zinc-500 hover:text-zinc-800"
      >
        &larr; Import
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Trim &amp; import</h1>

      {!sp.assetId || !sp.playbackId ? (
        <p className="mt-6 text-zinc-500">
          Open this from <span className="font-medium">Import</span> by choosing
          &ldquo;Trim &amp; import&rdquo; on a recording.
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
              initial={{ title: sp.title }}
              trim={{
                sourceAssetId: sp.assetId,
                rawPlaybackId: sp.playbackId,
                rawDurationSeconds: Number(sp.durationSeconds) || 0,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
