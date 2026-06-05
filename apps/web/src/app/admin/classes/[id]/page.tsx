import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAdminClass,
  getTagPickerData,
  getInstructorOptions,
  getCollectionOptions,
} from "@/lib/admin/queries";
import { getAssetMasterDownload, getAssetStatus } from "@/lib/mux/client";
import { ClassForm } from "@/components/admin/class-form";
import { ClassDownloadControl } from "@/components/admin/class-download-control";
import { DeleteClassButton } from "@/components/admin/delete-class-button";
import { DeleteRawRecordingButton } from "@/components/admin/delete-raw-recording-button";
import { setClassPublished } from "@/app/actions/classes";

export const dynamic = "force-dynamic";

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [cls, tagData, instructors, collections] = await Promise.all([
    getAdminClass(id),
    getTagPickerData(),
    getInstructorOptions(),
    getCollectionOptions(),
  ]);
  if (!cls) notFound();

  const published = !!cls.publishedAt;
  // Only a trimmed clip still awaiting cleanup has a source recording. Fetch its
  // status so the delete button is gated on the clip having finished encoding.
  const clipReady =
    cls.sourceMuxAssetId && cls.muxAssetId
      ? (await getAssetStatus(cls.muxAssetId)) === "ready"
      : false;
  const masterDownload = cls.muxAssetId
    ? await getAssetMasterDownload(cls.muxAssetId)
    : { status: "not_requested" as const, url: null };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Back
      </Link>
      <div className="mt-3 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Edit class</h1>
        <div className="flex items-center gap-4">
          <form action={setClassPublished}>
            <input type="hidden" name="id" value={cls.id} />
            <input type="hidden" name="publish" value={published ? "false" : "true"} />
            <button
              type="submit"
              className="text-sm font-medium text-zinc-600 hover:underline"
            >
              {published ? "Unpublish" : "Publish"}
            </button>
          </form>
          <DeleteClassButton id={cls.id} hasMuxAsset={!!cls.muxAssetId} />
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {cls.muxAssetId && (
          <ClassDownloadControl
            classId={cls.id}
            title={cls.title}
            initialStatus={masterDownload.status}
            initialUrl={masterDownload.url}
          />
        )}
        <ClassForm
          mode="edit"
          tagData={tagData}
          instructors={instructors}
          collections={collections}
          initial={{
            id: cls.id,
            title: cls.title,
            instructorId: cls.instructorId ?? "",
            description: cls.description,
            durationMinutes: cls.durationMinutes,
            muxPlaybackId: cls.muxPlaybackId ?? "",
            muxAssetId: cls.muxAssetId ?? "",
            classDate: cls.classDate ?? undefined,
            tagIds: cls.tagIds,
            collectionIds: cls.collectionIds,
          }}
        />
      </div>

      {cls.sourceMuxAssetId && (
        <div className="mt-8 max-w-2xl rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-700">Original recording</p>
          <p className="mt-1 text-xs text-zinc-500">
            This class is a trimmed clip. The full, untrimmed recording is still in
            Mux. Once the clip has finished processing you can delete the original
            to keep your Mux library tidy — the clip is independent and won&rsquo;t
            be affected.
          </p>
          <div className="mt-3">
            <DeleteRawRecordingButton id={cls.id} ready={clipReady} />
          </div>
        </div>
      )}
    </div>
  );
}
