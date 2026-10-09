"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { DoneLabel } from "@/components/workouts/done-label";
import { EQUIPMENT_ICONS } from "@/components/workouts/icons";
import { outfit } from "@/components/workouts/outfit";
import type { WorkoutStatus } from "@/lib/member/sessions";
import type { EquipmentIcon } from "@/lib/workouts/player";

export interface CarouselWorkout {
  id: string;
  title: string;
  imageUrl: string | null;
  /** "21 min · All levels" */
  meta: string;
  status: WorkoutStatus;
  /** "You'll need" — see equipmentPills. */
  pills: Array<{ key: string; label: string; icon: EquipmentIcon }>;
}

/** The gap between cards, in px (gap-3). */
const GAP = 12;

/**
 * This week's workouts on /workouts, one card at a time on a phone — the next
 * peeking in from the side, swiped between, dots underneath. On desktop the
 * same cards sit in a row, with arrows to page through them.
 *
 * Everything about the workout is on its cover: where the member is in it as
 * a pill at the top ("✓ Done · yesterday", "Resume · 40%", with a bar along
 * the bottom edge for the latter), and the title, length and level, and what
 * it needs below. The whole card opens the workout. Design: the "Web View"
 * canvas, Workouts option D.
 */
export function WorkoutCarousel({ workouts }: { workouts: CarouselWorkout[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + GAP : el.clientWidth;
    setIndex(Math.min(workouts.length - 1, Math.round(el.scrollLeft / step)));
    setCanBack(el.scrollLeft > 1);
    setCanForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, [workouts.length]);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const page = (direction: -1 | 1) => {
    const el = ref.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div>
      <div className="relative">
        {/* Edge to edge on a phone, so the next card peeks in from the
            screen's edge; the page's own column from tablet width up. */}
        <ul
          ref={ref}
          onScroll={update}
          aria-label="This week's workouts"
          className="-mx-6 flex snap-x snap-mandatory scroll-px-8 gap-3 overflow-x-auto px-8 [scrollbar-width:none] sm:-mx-8 md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {workouts.map((w) => (
            <li key={w.id} className="w-[calc(100vw-64px)] max-w-[360px] shrink-0 snap-center md:w-[326px] md:snap-start">
              <WorkoutCard workout={w} />
            </li>
          ))}
        </ul>

        {canBack && (
          <PageButton label="Previous workouts" side="left" onClick={() => page(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </PageButton>
        )}
        {canForward && (
          <PageButton label="More workouts" side="right" onClick={() => page(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </PageButton>
        )}
      </div>

      {workouts.length > 1 && (
        <div aria-hidden="true" className="mt-[18px] flex items-center justify-center gap-1.5 md:hidden">
          {workouts.map((w, i) => (
            <span
              key={w.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-[18px] bg-zinc-900 dark:bg-zinc-50" : "w-1.5 bg-black/20 dark:bg-white/25"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutCard({ workout: w }: { workout: CarouselWorkout }) {
  const status = w.status;
  return (
    <Link
      href={`/workouts/${w.id}`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-3xl bg-zinc-900 text-white"
    >
      {w.imageUrl && (
        <Image
          src={w.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 768px) 326px, 100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      )}
      {/* Darker top and bottom, for the pill and the text over the photo. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25)_0%,rgba(0,0,0,0)_20%,rgba(0,0,0,0)_42%,rgba(0,0,0,0.55)_66%,rgba(0,0,0,0.88)_100%)]"
      />

      {status && (
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-[7px] text-[13px] font-semibold backdrop-blur-lg">
          {status.kind === "done" ? (
            <>
              <Check size={14} strokeWidth={3} className="text-emerald-300" aria-hidden="true" />
              <DoneLabel at={status.at} />
            </>
          ) : (
            <>Resume · {status.percent}%</>
          )}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col px-[22px] pt-[22px] pb-7">
        <h2 className={`${outfit.className} text-[34px] leading-[0.98] font-extrabold tracking-[-0.01em] uppercase`}>
          {w.title}
        </h2>
        <span className="mt-2.5 text-[15px] text-white/80">{w.meta}</span>
        {w.pills.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {w.pills.map((p) => {
              const Icon = EQUIPMENT_ICONS[p.icon];
              return (
                <span
                  key={p.key}
                  className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-white/15 pr-3 pl-2.5 text-[13px] font-medium backdrop-blur-lg"
                >
                  <Icon size={15} />
                  {p.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* How far they got, along the bottom edge. */}
      {status?.kind === "resume" && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
          <span className="block h-full bg-violet-500" style={{ width: `${status.percent}%` }} />
        </span>
      )}
    </Link>
  );
}

function PageButton({
  label,
  side,
  onClick,
  children,
}: {
  label: string;
  side: "left" | "right";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur transition hover:bg-white md:flex dark:bg-[#25292E]/90 dark:text-zinc-50 dark:hover:bg-[#25292E] ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      {children}
    </button>
  );
}
