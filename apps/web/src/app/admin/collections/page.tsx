import { getAdminCollections } from "@/lib/admin/queries";
import { createCollection } from "@/app/actions/collections";
import { CollectionReorder } from "@/components/admin/collection-reorder";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const collections = await getAdminCollections();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
      <p className="mt-1 text-zinc-500">
        Curated and smart rows shown on the member browse page, top to bottom. Drag
        to reorder.
      </p>

      <form action={createCollection} className="mt-6 flex flex-wrap gap-2">
        <input
          name="title"
          placeholder="New collection title"
          required
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <select
          name="kind"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="manual">Manual</option>
          <option value="smart">Smart (tag rule)</option>
        </select>
        <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700">
          Create
        </button>
      </form>

      {collections.length === 0 ? (
        <p className="mt-10 text-zinc-500">No collections yet — create one above.</p>
      ) : (
        <CollectionReorder
          initialCollections={collections.map((c) => ({
            id: c.id,
            title: c.title,
            kind: c.kind,
            publishedAt: c.publishedAt,
            itemCount: c.itemCount,
          }))}
        />
      )}
    </div>
  );
}
