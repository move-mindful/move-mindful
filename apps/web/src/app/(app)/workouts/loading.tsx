import { WeekStrip } from "@/components/workouts/week-strip";

/**
 * /workouts while it loads, in the page's own shape rather than the generic
 * placeholder in (app)/loading.tsx. The title and week strip are the real
 * ones — neither waits on anything — so only the cards are blanks: one with
 * the next peeking in on a phone (dots underneath), a row on desktop, with
 * the title, meta and equipment pills blocked in where they sit on a cover.
 *
 * The sizes are WorkoutCarousel's (page.tsx's wrapper, the list's edge-to-edge
 * margins, the card's width, 2:3 shape and phone height cap), so nothing jumps
 * when the page swaps in. Keep in step with those.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-8 md:pt-10 md:pb-10">
      {/* On a phone the header already says Your plan, and has the strip. */}
      <h1 className="text-2xl font-bold tracking-tight max-md:sr-only">Your plan</h1>
      <div className="hidden md:mt-6 md:block">
        <WeekStrip />
      </div>

      <div role="status" aria-label="Loading" className="animate-pulse md:mt-6">
        <div className="-mx-6 flex gap-3 overflow-hidden px-8 sm:-mx-8 md:mx-0 md:px-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[calc(100vw-64px)] max-w-[360px] shrink-0 md:w-[326px]">
              <div className="relative aspect-[2/3] rounded-3xl bg-zinc-100 max-md:max-h-[calc(100svh-290px)] dark:bg-white/[0.06]">
                <div className="absolute inset-x-0 bottom-0 flex flex-col px-[22px] pb-7">
                  <div className="h-8 w-3/4 rounded-lg bg-zinc-200/80 dark:bg-white/10" />
                  <div className="mt-3 h-4 w-2/5 rounded bg-zinc-200/80 dark:bg-white/10" />
                  <div className="mt-3.5 flex gap-1.5">
                    <div className="h-[30px] w-20 rounded-full bg-zinc-200/80 dark:bg-white/10" />
                    <div className="h-[30px] w-24 rounded-full bg-zinc-200/80 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[18px] flex items-center justify-center gap-1.5 md:hidden">
          <span className="h-1.5 w-[18px] rounded-full bg-zinc-200 dark:bg-white/15" />
          <span className="size-1.5 rounded-full bg-zinc-200 dark:bg-white/15" />
          <span className="size-1.5 rounded-full bg-zinc-200 dark:bg-white/15" />
        </div>
      </div>
    </div>
  );
}
