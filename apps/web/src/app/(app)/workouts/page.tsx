import { auth } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getSessionSummaries, workoutStatuses } from "@/lib/member/sessions-server";
import { getWorkoutCards } from "@/lib/workouts/member";
import { getThisWeekIds } from "@/lib/workouts/server";
import { equipmentPills, levelLabel } from "@/lib/workouts/player";
import { PlanTitle } from "@/components/workouts/plan-title";
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
    // On a phone the page fits the screen: the cards size to it (WorkoutCard).
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 sm:px-8 md:pt-10 md:pb-10">
      <PlanTitle />
      {/* On a phone the strip is in the header's pane instead (PhoneHeader). */}
      <div className="hidden md:mt-6 md:block">
        <WeekStrip />
      </div>
      {workouts.length === 0 ? (
        <p className="text-zinc-500 md:mt-6 dark:text-zinc-400">No workouts yet.</p>
      ) : (
        <div className="md:mt-6">
          <WorkoutCarousel
            workouts={workouts.map((w) => ({
              id: w.id,
              title: w.title,
              imageUrl: w.imageUrl,
              meta: [`${w.minutes} min`, levelLabel(w.level)].filter(Boolean).join(" · "),
              status: statuses?.get(w.id) ?? null,
              pills: equipmentPills(w, { combineWeights: true }),
            }))}
          />
        </div>
      )}
    </div>
  );
}
