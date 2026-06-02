import { getTagsAdmin } from "@/lib/admin/queries";
import { TagManager } from "@/components/admin/tag-manager";

export const dynamic = "force-dynamic";

export default async function AdminTagsPage() {
  const data = await getTagsAdmin();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
      <p className="mt-1 text-zinc-500">
        Group and label classes. Discipline + Intensity drive the card badges; other
        groups become filter chips.
      </p>
      <div className="mt-8">
        <TagManager data={data} />
      </div>
    </div>
  );
}
