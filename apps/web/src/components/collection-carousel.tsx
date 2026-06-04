import Image from "next/image";
import Link from "next/link";
import { InstructorAvatar } from "@/components/instructor-avatar";
import { formatClassDate } from "@/lib/format-date";
import type { BrowseRow } from "@/lib/collections";

const intensityBadge: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

export function CollectionCarousel({ row }: { row: BrowseRow }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{row.title}</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {row.classes.map((c) => (
          <Link
            key={c.id}
            href={`/classes/${c.id}`}
            className="group w-64 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md"
          >
            <div className="relative aspect-video bg-zinc-100">
              {c.muxPlaybackId ? (
                <Image
                  src={`https://image.mux.com/${c.muxPlaybackId}/thumbnail.webp?width=512&height=288&fit_mode=smartcrop`}
                  alt={c.title}
                  fill
                  unoptimized
                  className="object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  No preview
                </div>
              )}
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                {c.durationMinutes} min
              </span>
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                  {c.disciplineLabel && (
                    <span className="truncate font-medium text-zinc-500">
                      {c.disciplineLabel}
                    </span>
                  )}
                  {c.intensityLabel && (
                    <>
                      {c.disciplineLabel && <span className="text-zinc-300">&middot;</span>}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          (c.intensitySlug && intensityBadge[c.intensitySlug]) ||
                          "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {c.intensityLabel}
                      </span>
                    </>
                  )}
                </div>
                {c.classDate && (
                  <span className="shrink-0 text-zinc-400">{formatClassDate(c.classDate)}</span>
                )}
              </div>
              <h3 className="mt-1.5 font-semibold leading-snug group-hover:text-zinc-600">
                {c.title}
              </h3>
              {c.instructorName && (
                <div className="mt-1.5 flex items-center gap-2">
                  <InstructorAvatar
                    name={c.instructorName}
                    src={c.instructorAvatarUrl}
                    size={24}
                  />
                  <p className="truncate text-sm text-zinc-500">{c.instructorName}</p>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
