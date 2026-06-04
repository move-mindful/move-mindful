"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InstructorAvatar } from "@/components/instructor-avatar";
import { formatClassDate } from "@/lib/format-date";
import type { BrowseRow } from "@/lib/collections";

const intensityBadge: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
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
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-zinc-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canScrollRight}
              aria-label={`Scroll ${row.title} forward`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-zinc-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-4 overflow-x-auto pb-2"
        >
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

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent transition-opacity duration-200 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent transition-opacity duration-200 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </section>
  );
}
