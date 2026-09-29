import { notFound } from "next/navigation";
import { getExercise, getExerciseOptions, getExerciseTags } from "@/lib/exercises/server";
import { ExerciseForm } from "@/components/admin/exercises/exercise-form";

export const dynamic = "force-dynamic";

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exercise, tags, exerciseOptions] = await Promise.all([getExercise(id), getExerciseTags(), getExerciseOptions()]);
  if (!exercise) notFound();
  // Keyed by id so moving between exercises starts the form fresh.
  return <ExerciseForm key={exercise.id} exercise={exercise} tags={tags} exerciseOptions={exerciseOptions} />;
}
