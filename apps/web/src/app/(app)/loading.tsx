/**
 * What shows the moment a signed-in page is tapped, while it renders: the
 * navigation stays, and the page area holds a quiet placeholder.
 *
 * Every page here is rendered per request (it depends on who's signed in), and
 * without a loading state Next.js can't prefetch them or move on until the
 * server has finished — taps would look ignored. With it, the placeholder is
 * prefetched and the switch is immediate.
 */
export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl animate-pulse px-6 pt-6 pb-10 sm:px-8 md:pt-10"
      role="status"
      aria-label="Loading"
    >
      <div className="h-7 w-44 rounded-lg bg-zinc-200/80 dark:bg-white/10" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="aspect-[3/4] rounded-2xl bg-zinc-100 dark:bg-white/[0.06]" />
            <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-white/[0.06]" />
            <div className="h-3.5 w-1/2 rounded bg-zinc-100 dark:bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}
