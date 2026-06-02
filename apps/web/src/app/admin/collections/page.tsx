import Link from "next/link";
import { getAdminCollections } from "@/lib/admin/queries";
import {
  createCollection,
  setCollectionPublished,
  moveCollection,
} from "@/app/actions/collections";
import { DeleteCollectionButton } from "@/components/admin/delete-collection-button";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const collections = await getAdminCollections();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
      <p className="mt-1 text-zinc-500">
        Curated and smart rows shown on the member browse page, top to bottom.
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
        <div className="mt-8 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {collections.map((c, i) => {
            const published = !!c.publishedAt;
            return (
              <div key={c.id} className="flex items-center gap-4 p-4">
                <div className="flex flex-col">
                  {i > 0 && (
                    <form action={moveCollection}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" aria-label="Move up" className="text-zinc-400 hover:text-zinc-700">
                        ↑
                      </button>
                    </form>
                  )}
                  {i < collections.length - 1 && (
                    <form action={moveCollection}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" aria-label="Move down" className="text-zinc-400 hover:text-zinc-700">
                        ↓
                      </button>
                    </form>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/collections/${c.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      {c.kind === "smart" ? "Smart" : "Manual"}
                    </span>
                    {published ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Published
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {c.kind === "smart"
                      ? `${c.itemCount} rule tag${c.itemCount !== 1 ? "s" : ""}`
                      : `${c.itemCount} class${c.itemCount !== 1 ? "es" : ""}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <form action={setCollectionPublished}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="publish" value={published ? "false" : "true"} />
                    <button type="submit" className="text-sm text-zinc-600 hover:underline">
                      {published ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/collections/${c.id}`}
                    className="text-sm text-zinc-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteCollectionButton id={c.id} title={c.title} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
