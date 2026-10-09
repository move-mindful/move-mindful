import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getSessionSummaries, workoutStatuses } from "@/lib/member/sessions-server";
import { getWorkoutCards } from "@/lib/workouts/member";
import { getThisWeekIds } from "@/lib/workouts/server";
import { levelLabel } from "@/lib/workouts/player";
import { DoneLabel } from "@/components/workouts/done-label";
import { WeekStrip } from "@/components/workouts/week-strip";

/**
 * This week's workouts — the published ones picked on the admin workouts
 * page, in that order — each with where the member is in it: "Resume · 40%"
 * or "Done · 3 days ago". The rest still play from their links. A plain list
 * for now — where workouts live on /home is decided with their access in
 * plan.md, Phase 4.5 step 6. Admin-only until then, like Classes and Live.
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
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {workouts.map((w) => {
            const status = statuses?.get(w.id) ?? null;
            return (
              <Link key={w.id} href={`/workouts/${w.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200 dark:bg-white/10">
                  {w.imageUrl && (
                    <Image
                      src={w.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  )}
                  {/* How far they got, along the bottom of the cover. */}
                  {status?.kind === "resume" && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25">
                      <div className="h-full bg-violet-500" style={{ width: `${status.percent}%` }} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold leading-snug">{w.title}</div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {[`${w.minutes} min`, levelLabel(w.level)].filter(Boolean).join(" · ")}
                  </div>
                  {status?.kind === "resume" && (
                    <div className="mt-0.5 text-sm font-semibold text-violet-700 dark:text-violet-300">Resume · {status.percent}%</div>
                  )}
                  {status?.kind === "done" && (
                    <div className="mt-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      <DoneLabel at={status.at} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
