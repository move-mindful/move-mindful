import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getViewerAccess } from "@/lib/auth/viewer";
import { getWorkoutStatuses } from "@/lib/member/sessions-server";
import { getWorkoutCards } from "@/lib/workouts/member";
import { levelLabel } from "@/lib/workouts/player";
import { DoneLabel } from "@/components/workouts/done-label";

/**
 * Every published workout (drafts too, for admins), each with where the
 * member is in it: "Resume · 40%" or "Done · 3 days ago". A plain list for
 * now — where workouts live on /home is decided with their access in plan.md,
 * Phase 4.5 step 6. Admin-only until then, like Classes and Live.
 */
export default async function WorkoutsPage() {
  await requireSectionUnlocked();
  const [viewer, { userId }] = await Promise.all([getViewerAccess(), auth()]);
  const workouts = await getWorkoutCards(viewer.isAdmin);
  const statuses = userId ? await getWorkoutStatuses(userId, workouts) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Workouts</h1>
      {workouts.length === 0 ? (
        <p className="mt-6 text-zinc-500">No workouts yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {workouts.map((w) => {
            const status = statuses?.get(w.id) ?? null;
            return (
              <Link key={w.id} href={`/workouts/${w.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200">
                  {w.imageUrl && (
                    <Image
                      src={w.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  )}
                  {!w.published && (
                    <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      Draft
                    </span>
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
                  <div className="text-sm text-zinc-500">
                    {[`${w.minutes} min`, levelLabel(w.level)].filter(Boolean).join(" · ")}
                  </div>
                  {status?.kind === "resume" && (
                    <div className="mt-0.5 text-sm font-semibold text-violet-700">Resume · {status.percent}%</div>
                  )}
                  {status?.kind === "done" && (
                    <div className="mt-0.5 text-sm font-medium text-emerald-700">
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
