/**
 * What shows the moment an admin page is tapped, while it renders (several
 * check Mux for clip status first): the admin header stays, and the page area
 * holds a placeholder list. See (app)/loading.tsx for why it matters.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-6 py-12" role="status" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-zinc-200/80" />
        <div className="h-9 w-28 rounded-lg bg-zinc-100" />
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
