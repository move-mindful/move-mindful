import { notFound } from "next/navigation";
import { getInstructorOptions } from "@/lib/admin/queries";
import { getCatalog, getWorkout } from "@/lib/workouts/server";
import { WorkoutBuilder } from "@/components/admin/workouts/workout-builder";

export const dynamic = "force-dynamic";

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workout, catalog, instructors] = await Promise.all([getWorkout(id), getCatalog(), getInstructorOptions()]);
  if (!workout) notFound();
  return <WorkoutBuilder key={workout.id} workout={workout} catalog={catalog} instructors={instructors} />;
}
