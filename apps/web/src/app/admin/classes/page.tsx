import Link from "next/link";
import Image from "next/image";
import { getAdminClasses } from "@/lib/admin/queries";
import { formatClassDate } from "@/lib/format-date";
import { setClassPublished } from "@/app/actions/classes";
import { DeleteRawRecordingButton } from "@/components/admin/delete-raw-recording-button";
import { DeleteClassButton } from "@/components/admin/delete-class-button";

export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
  const classes = await getAdminClasses();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="mt-1 text-zinc-500">
            {classes.length} total
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/classes/import"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
          >
            Import
          </Link>
          <Link
            href="/admin/classes/upload"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Upload
          </Link>
        </div>
      </div>

      {classes.length === 0 ? (
        <p className="mt-10 text-zinc-500">
          No classes yet — use Import to add your videos.
        </p>
      ) : (
        <div className="mt-8 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {classes.map((c) => {
            const published = !!c.publishedAt;
            const unlisted = published && !c.surfaced;
            return (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded bg-zinc-100">
                  {c.muxPlaybackId && (
                    <Image
                      src={`https://image.mux.com/${c.muxPlaybackId}/thumbnail.webp?width=240&height=140&fit_mode=smartcrop`}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/classes/${c.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    {published ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        Draft
                      </span>
                    )}
                    {unlisted && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Unlisted
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-zinc-500">
                    {[
                      c.instructorName,
                      `${c.durationMinutes} min`,
                      c.classDate && formatClassDate(c.classDate),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <form action={setClassPublished}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="publish" value={published ? "false" : "true"} />
                    <button type="submit" className="text-sm text-zinc-600 hover:underline">
                      {published ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="text-sm text-zinc-600 hover:underline"
                  >
                    Edit
                  </Link>
                  {c.sourceMuxAssetId && (
                    <DeleteRawRecordingButton id={c.id} ready={c.clipReady} label="Delete raw" />
                  )}
                  <DeleteClassButton id={c.id} hasMuxAsset={!!c.muxAssetId} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
