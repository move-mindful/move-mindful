import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminClass, getTagPickerData } from "@/lib/admin/queries";
import { ClassForm } from "@/components/admin/class-form";
import { DeleteClassButton } from "@/components/admin/delete-class-button";
import { setClassPublished } from "@/app/actions/classes";

export const dynamic = "force-dynamic";

export default async function EditClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [cls, tagData] = await Promise.all([getAdminClass(id), getTagPickerData()]);
  if (!cls) notFound();

  const published = !!cls.publishedAt;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Classes
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

      <div className="mt-8">
        <ClassForm
          mode="edit"
          tagData={tagData}
          initial={{
            id: cls.id,
            title: cls.title,
            instructorName: cls.instructorName,
            description: cls.description,
            durationMinutes: cls.durationMinutes,
            muxPlaybackId: cls.muxPlaybackId ?? "",
            muxAssetId: cls.muxAssetId ?? "",
            tagIds: cls.tagIds,
          }}
        />
      </div>
    </div>
  );
}
