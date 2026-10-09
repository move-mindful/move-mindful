import Link from "next/link";
import { getThisWeekIds, getWorkouts } from "@/lib/workouts/server";
import { WorkoutList } from "@/components/admin/workouts/workout-list";

export const dynamic = "force-dynamic";

// Exercise-by-exercise workouts built from the exercise library (plan.md, Phase 4.5),
// under This Week's Workouts — the ones /workouts shows members (WorkoutList).
// ?sort=rating lists them highest rated first (then most ratings); otherwise
// most recently edited first.
export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ sort }, all, thisWeek] = await Promise.all([searchParams, getWorkouts(), getThisWeekIds()]);
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
        <WorkoutList
          workouts={workouts}
          thisWeek={thisWeek}
          sortControl={
            <div className="flex gap-0.5 rounded-lg bg-zinc-100 p-0.5 text-sm" aria-label="Sort">
              <Link href="/admin/workouts" className={sortLink(!byRating)} aria-current={!byRating}>
                Recently edited
              </Link>
              <Link href="/admin/workouts?sort=rating" className={sortLink(byRating)} aria-current={byRating}>
                Highest rated
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
