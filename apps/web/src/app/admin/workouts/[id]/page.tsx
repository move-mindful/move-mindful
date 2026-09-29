import { notFound } from "next/navigation";
import { getInstructorOptions } from "@/lib/admin/queries";
import { getExerciseTags } from "@/lib/exercises/server";
import { getGeneratorInstructions } from "@/lib/workouts/generate";
import { getCatalog, getWorkout } from "@/lib/workouts/server";
import { WorkoutBuilder } from "@/components/admin/workouts/workout-builder";

export const dynamic = "force-dynamic";
// Room for "Generate with AI" (a server action on this page) to hear back from Claude.
export const maxDuration = 60;

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workout, catalog, instructors, tags, aiInstructions] = await Promise.all([
    getWorkout(id),
    getCatalog(),
    getInstructorOptions(),
    getExerciseTags(),
    getGeneratorInstructions(),
  ]);
  if (!workout) notFound();
  return (
    <WorkoutBuilder
      key={workout.id}
      workout={workout}
      catalog={catalog}
      instructors={instructors}
      tags={tags}
      aiInstructions={aiInstructions}
    />
  );
}
