import { getInstructorOptions } from "@/lib/admin/queries";
import { getExerciseTags } from "@/lib/exercises/server";
import { getCatalog } from "@/lib/workouts/server";
import { WorkoutBuilder } from "@/components/admin/workouts/workout-builder";

export const dynamic = "force-dynamic";
// Room for "Generate with AI" (a server action on this page) to hear back from Claude.
export const maxDuration = 60;

export default async function NewWorkoutPage() {
  const [catalog, instructors, tags] = await Promise.all([getCatalog(), getInstructorOptions(), getExerciseTags()]);
  return <WorkoutBuilder workout={null} catalog={catalog} instructors={instructors} tags={tags} />;
}
