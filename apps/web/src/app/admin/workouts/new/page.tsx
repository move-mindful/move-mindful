import { getInstructorOptions } from "@/lib/admin/queries";
import { getCatalog } from "@/lib/workouts/server";
import { WorkoutBuilder } from "@/components/admin/workouts/workout-builder";

export const dynamic = "force-dynamic";

export default async function NewWorkoutPage() {
  const [catalog, instructors] = await Promise.all([getCatalog(), getInstructorOptions()]);
  return <WorkoutBuilder workout={null} catalog={catalog} instructors={instructors} />;
}
