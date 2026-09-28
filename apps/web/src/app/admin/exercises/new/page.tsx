import { getExerciseTags } from "@/lib/exercises/server";
import { ExerciseForm } from "@/components/admin/exercises/exercise-form";

export const dynamic = "force-dynamic";

export default async function NewExercisePage() {
  const tags = await getExerciseTags();
  return <ExerciseForm exercise={null} tags={tags} />;
}
