import Link from "next/link";
import {
  getTagPickerData,
  getInstructorOptions,
  getCollectionOptions,
} from "@/lib/admin/queries";
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
  const [tagData, instructors, collections] = await Promise.all([
    getTagPickerData(),
    getInstructorOptions(),
    getCollectionOptions(),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin/classes" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Classes
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">New class</h1>
      {sp.assetId && (
        <p className="mt-1 text-sm text-zinc-500">
          Imported from Mux — fill in the details below.
        </p>
      )}

      <div className="mt-8">
        <ClassForm
          mode="create"
          tagData={tagData}
          instructors={instructors}
          collections={collections}
          initial={{
            muxAssetId: sp.assetId,
            muxPlaybackId: sp.playbackId,
            durationMinutes: sp.duration,
            title: sp.title,
          }}
        />
      </div>
    </div>
  );
}
