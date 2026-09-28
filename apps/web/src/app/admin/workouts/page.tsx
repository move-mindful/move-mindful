import Image from "next/image";
import Link from "next/link";
import { aboutMinutes } from "@move-mindful/core";
import { getWorkouts } from "@/lib/workouts/server";
import { LEVELS } from "@/lib/workouts/shared";

export const dynamic = "force-dynamic";

// Exercise-by-exercise workouts built from the exercise library (plan.md, Phase 4.5).
export default async function WorkoutsPage() {
  const workouts = await getWorkouts();

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workouts</h1>
          <p className="mt-1 text-zinc-500">{workouts.length} total</p>
        </div>
        <Link
          href="/admin/workouts/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          New workout
        </Link>
      </div>

      {workouts.length === 0 ? (
        <p className="mt-10 text-zinc-500">
          No workouts yet. Upload exercises in{" "}
          <Link href="/admin/exercises" className="underline hover:text-zinc-700">
            Exercises
          </Link>
          , then build one here.
        </p>
      ) : (
        <div className="mt-8 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {workouts.map((w) => (
            <Link key={w.id} href={`/admin/workouts/${w.id}`} className="flex items-center gap-4 p-4 transition hover:bg-zinc-50">
              <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-zinc-100">
                {w.coverImageUrl && <Image src={w.coverImageUrl} alt="" fill unoptimized className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{w.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      w.publishedAt ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {w.publishedAt ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="truncate text-sm text-zinc-500">
                  {[
                    w.totalSeconds ? `About ${aboutMinutes(w.totalSeconds)} min` : "Empty",
                    `${w.exerciseCount} exercise${w.exerciseCount === 1 ? "" : "s"}`,
                    w.hasWarmup && "warm-up",
                    LEVELS.find((l) => l.id === w.level)?.label,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="text-sm text-zinc-500">Edit</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
