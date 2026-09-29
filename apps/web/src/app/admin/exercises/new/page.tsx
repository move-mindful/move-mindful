import { getExerciseOptions, getExerciseTags } from "@/lib/exercises/server";
import { ExerciseForm } from "@/components/admin/exercises/exercise-form";

export const dynamic = "force-dynamic";

export default async function NewExercisePage() {
  const [tags, exerciseOptions] = await Promise.all([getExerciseTags(), getExerciseOptions()]);
  return <ExerciseForm exercise={null} tags={tags} exerciseOptions={exerciseOptions} />;
}
