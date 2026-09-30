import Link from "next/link";
import { getExerciseTags, getExercises } from "@/lib/exercises/server";
import { ExerciseLibrary } from "@/components/admin/exercises/exercise-library";

export const dynamic = "force-dynamic";

// The exercise library: every clip-based exercise and warm-up that workouts are
// built from (plan.md, Phase 4.5).
export default async function ExercisesPage() {
  const [exercises, tags] = await Promise.all([getExercises(), getExerciseTags()]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
        <Link
          href="/admin/exercises/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          Add exercise
        </Link>
      </div>
      <ExerciseLibrary exercises={exercises} tags={tags} />
    </div>
  );
}
