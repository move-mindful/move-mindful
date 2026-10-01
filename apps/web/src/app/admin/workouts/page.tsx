import Image from "next/image";
import Link from "next/link";
import { aboutMinutes } from "@move-mindful/core";
import { getWorkouts } from "@/lib/workouts/server";
import { LEVELS } from "@/lib/workouts/shared";
import { DeleteWorkoutButton } from "@/components/admin/workouts/delete-workout-button";
import { RatingBadge } from "@/components/admin/workouts/rating";

export const dynamic = "force-dynamic";

// Exercise-by-exercise workouts built from the exercise library (plan.md, Phase 4.5).
// ?sort=rating lists them highest rated first (then most ratings); otherwise
// most recently edited first.
export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ sort }, all] = await Promise.all([searchParams, getWorkouts()]);
  const byRating = sort === "rating";
  const workouts = byRating
    ? [...all].sort(
        (a, b) => (b.rating?.average ?? -1) - (a.rating?.average ?? -1) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0),
      )
    : all;
  const sortLink = (on: boolean) =>
    `rounded-md px-2.5 py-1 transition ${on ? "bg-white font-semibold text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`;

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
        <>
          <div className="mt-8 flex justify-end">
            <div className="flex gap-0.5 rounded-lg bg-zinc-100 p-0.5 text-sm" aria-label="Sort">
              <Link href="/admin/workouts" className={sortLink(!byRating)} aria-current={!byRating}>
                Recently edited
              </Link>
              <Link href="/admin/workouts?sort=rating" className={sortLink(byRating)} aria-current={byRating}>
                Highest rated
              </Link>
            </div>
          </div>
          <div className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
            {workouts.map((w) => (
              // The thumbnail and title open the builder; Preview, Edit and Delete sit on the right.
              <div key={w.id} className="flex items-center gap-4 p-4 transition hover:bg-zinc-50">
                <Link href={`/admin/workouts/${w.id}`} className="flex min-w-0 flex-1 items-center gap-4">
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
                        w.hasCooldown && "cool-down",
                        LEVELS.find((l) => l.id === w.level)?.label,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </Link>
                <div className="w-28 shrink-0">
                  <RatingBadge rating={w.rating} />
                </div>
                <div className="flex shrink-0 items-center gap-5 text-sm font-medium">
                  {/* The member view of the saved version (drafts show to admins only). */}
                  <a
                    href={`/workouts/${w.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 transition hover:text-zinc-900"
                  >
                    Preview ↗
                  </a>
                  <Link href={`/admin/workouts/${w.id}`} className="text-zinc-500 transition hover:text-zinc-900">
                    Edit
                  </Link>
                  <DeleteWorkoutButton id={w.id} title={w.title} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
