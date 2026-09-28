import Image from "next/image";
import Link from "next/link";
import { requireSectionUnlocked } from "@/lib/auth/locked-sections";
import { getViewerAccess } from "@/lib/auth/viewer";
import { getWorkoutCards } from "@/lib/workouts/member";
import { levelLabel } from "@/lib/workouts/player";

/**
 * Every published workout (drafts too, for admins). A plain list for now —
 * where workouts live on /home is decided with their access in plan.md,
 * Phase 4.5 step 6. Admin-only until then, like Classes and Live.
 */
export default async function WorkoutsPage() {
  await requireSectionUnlocked();
  const viewer = await getViewerAccess();
  const workouts = await getWorkoutCards(viewer.isAdmin);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Workouts</h1>
      {workouts.length === 0 ? (
        <p className="mt-6 text-zinc-500">No workouts yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {workouts.map((w) => (
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
              </div>
              <div>
                <div className="font-semibold leading-snug">{w.title}</div>
                <div className="text-sm text-zinc-500">
                  {[`${w.minutes} min`, levelLabel(w.level)].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
