"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InstructorAvatar } from "@/components/instructor-avatar";
import { formatClassDate } from "@/lib/format-date";
import type { BrowseRow } from "@/lib/collections";

const intensityBadge: Record<string, string> = {
  beginner: "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  intermediate: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
  advanced: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300",
};

export function CollectionCarousel({ row }: { row: BrowseRow }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{row.title}</h2>
        {showArrows && (
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!canScrollLeft}
              aria-label={`Scroll ${row.title} backward`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-white/[0.03] disabled:hover:text-zinc-600 dark:disabled:hover:text-zinc-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canScrollRight}
              aria-label={`Scroll ${row.title} forward`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/[0.06] hover:text-zinc-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-white/[0.03] disabled:hover:text-zinc-600 dark:disabled:hover:text-zinc-300"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="mt-4 flex gap-4 overflow-x-auto pb-2"
      >
        {row.classes.map((c) => (
          <Link
            key={c.id}
            href={`/classes/${c.id}`}
            className="group w-64 shrink-0 overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] transition hover:shadow-md"
          >
            <div className="relative aspect-video bg-zinc-100 dark:bg-white/[0.06]">
              {c.muxPlaybackId ? (
                <Image
                  src={`https://image.mux.com/${c.muxPlaybackId}/thumbnail.webp?width=512&height=288&fit_mode=smartcrop`}
                  alt={c.title}
                  fill
                  unoptimized
                  className="object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400 dark:text-zinc-500">
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
                    <span className="truncate font-medium text-zinc-500 dark:text-zinc-400">
                      {c.disciplineLabel}
                    </span>
                  )}
                  {c.intensityLabel && (
                    <>
                      {c.disciplineLabel && <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>}
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          (c.intensitySlug && intensityBadge[c.intensitySlug]) ||
                          "bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {c.intensityLabel}
                      </span>
                    </>
                  )}
                </div>
                {c.classDate && (
                  <span className="shrink-0 text-zinc-400 dark:text-zinc-500">{formatClassDate(c.classDate)}</span>
                )}
              </div>
              <h3 className="mt-1.5 font-semibold leading-snug group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                {c.title}
              </h3>
              {c.instructorName && (
                <div className="mt-1.5 flex items-center gap-2">
                  <InstructorAvatar
                    name={c.instructorName}
                    src={c.instructorAvatarUrl}
                    size={24}
                  />
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">{c.instructorName}</p>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
