import { auth } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getSessionSummaries, workoutStatuses } from "@/lib/member/sessions-server";
import { getWorkoutCards } from "@/lib/workouts/member";
import { getThisWeekIds } from "@/lib/workouts/server";
import { equipmentPills, levelLabel } from "@/lib/workouts/player";
import { WeekStrip } from "@/components/workouts/week-strip";
import { WorkoutCarousel } from "@/components/workouts/workout-carousel";

/**
 * This week's workouts — the published ones picked on the admin workouts
 * page, in that order — under the week strip, as a carousel of cards (one at
 * a time on a phone), each with where the member is in it: "Resume · 40%" or
 * "Done · 3 days ago". The rest still play from their links. Where workouts
 * live on /home is decided with their access in plan.md, Phase 4.5 step 6.
 * Admin-only until then, like Classes and Live.
 */
export default async function WorkoutsPage() {
  await requireSectionUnlocked();
  const { userId } = await auth();
  const [workouts, sessions] = await Promise.all([
    getThisWeekIds().then(getWorkoutCards),
    userId ? getSessionSummaries(userId) : null,
  ]);
  const statuses = sessions ? workoutStatuses(workouts, sessions) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-10 sm:px-8 md:pt-10">
      {/* On a phone the header already says Workouts. */}
      <h1 className="text-2xl font-bold tracking-tight max-md:sr-only">Workouts</h1>
      <div className="md:mt-6">
        <WeekStrip />
      </div>
      {workouts.length === 0 ? (
        <p className="mt-6 text-zinc-500 dark:text-zinc-400">No workouts yet.</p>
      ) : (
        <div className="mt-6">
          <WorkoutCarousel
            workouts={workouts.map((w) => ({
              id: w.id,
              title: w.title,
              imageUrl: w.imageUrl,
              meta: [`${w.minutes} min`, levelLabel(w.level)].filter(Boolean).join(" · "),
              status: statuses?.get(w.id) ?? null,
              pills: equipmentPills(w),
            }))}
          />
        </div>
      )}
    </div>
  );
}
