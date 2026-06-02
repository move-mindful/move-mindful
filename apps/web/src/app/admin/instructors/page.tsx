import { getInstructors } from "@/lib/admin/queries";
import { InstructorManager } from "@/components/admin/instructor-manager";

export const dynamic = "force-dynamic";

export default async function AdminInstructorsPage() {
  const instructors = await getInstructors();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Instructors</h1>
      <p className="mt-1 text-zinc-500">
        Add teachers and a profile photo. Each class is assigned one instructor, whose
        photo shows next to their name on the class cards.
      </p>
      <div className="mt-8">
        <InstructorManager instructors={instructors} />
      </div>
    </div>
  );
}
