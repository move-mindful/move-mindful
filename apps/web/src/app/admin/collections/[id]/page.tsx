import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getAdminCollection,
  getAdminClasses,
  getTagPickerData,
  getSmartPreview,
  type AdminClassRow,
} from "@/lib/admin/queries";
import {
  updateCollection,
  setCollectionPublished,
  addClassToCollection,
  removeClassFromCollection,
  moveClassInCollection,
  setCollectionRuleTags,
} from "@/app/actions/collections";
import { DeleteCollectionButton } from "@/components/admin/delete-collection-button";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collection = await getAdminCollection(id);
  if (!collection) notFound();

  const published = !!collection.publishedAt;

  let body = null;
  if (collection.kind === "manual") {
    const allClasses = await getAdminClasses();
    const byId = new Map(allClasses.map((c) => [c.id, c]));
    const memberSet = new Set(collection.memberClassIds);
    const members = collection.memberClassIds
      .map((cid) => byId.get(cid))
      .filter((c): c is AdminClassRow => !!c);
    const nonMembers = allClasses.filter((c) => !memberSet.has(c.id));

    body = (
      <section>
        <h2 className="text-lg font-semibold">Classes in this collection</h2>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No classes yet — add some below.</p>
        ) : (
          <div className="mt-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
            {members.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-zinc-100">
                  {c.muxPlaybackId && (
                    <Image
                      src={`https://image.mux.com/${c.muxPlaybackId}/thumbnail.webp?width=160&height=100&fit_mode=smartcrop`}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {c.title}
                  {!c.publishedAt && (
                    <span className="ml-2 text-xs text-amber-600">draft</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {i > 0 && (
                    <form action={moveClassInCollection}>
                      <input type="hidden" name="collectionId" value={collection.id} />
                      <input type="hidden" name="classId" value={c.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" aria-label="Move up" className="text-zinc-400 hover:text-zinc-700">
                        ↑
                      </button>
                    </form>
                  )}
                  {i < members.length - 1 && (
                    <form action={moveClassInCollection}>
                      <input type="hidden" name="collectionId" value={collection.id} />
                      <input type="hidden" name="classId" value={c.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" aria-label="Move down" className="text-zinc-400 hover:text-zinc-700">
                        ↓
                      </button>
                    </form>
                  )}
                  <form action={removeClassFromCollection}>
                    <input type="hidden" name="collectionId" value={collection.id} />
                    <input type="hidden" name="classId" value={c.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {nonMembers.length > 0 && (
          <form action={addClassToCollection} className="mt-4 flex gap-2">
            <input type="hidden" name="collectionId" value={collection.id} />
            <select name="classId" className={inputCls} defaultValue="">
              <option value="" disabled>
                Add a class…
              </option>
              {nonMembers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.publishedAt ? "" : " (draft)"}
                </option>
              ))}
            </select>
            <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50">
              Add
            </button>
          </form>
        )}
      </section>
    );
  } else {
    const tagData = await getTagPickerData();
    const preview = await getSmartPreview(collection.ruleTagIds, collection.matchMode);

    body = (
      <section>
        <h2 className="text-lg font-semibold">Tag rule</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Classes matching {collection.matchMode === "all" ? "all" : "any"} of these tags
          are included automatically.
        </p>

        <form action={setCollectionRuleTags} className="mt-4 space-y-4">
          <input type="hidden" name="collectionId" value={collection.id} />
          {tagData.groups.map((g) => (
            <fieldset key={g.id}>
              <legend className="text-sm font-medium text-zinc-700">{g.name}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {g.tags.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="tagIds"
                      value={t.id}
                      defaultChecked={collection.ruleTagIds.includes(t.id)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {tagData.ungrouped.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium text-zinc-700">Other tags</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {tagData.ungrouped.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="tagIds"
                      value={t.id}
                      defaultChecked={collection.ruleTagIds.includes(t.id)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700">
            Save rule
          </button>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-zinc-700">
            Preview — {preview.length} class{preview.length !== 1 ? "es" : ""} match
          </h3>
          {preview.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-zinc-600">
              {preview.map((p) => (
                <li key={p.id}>
                  {p.title}
                  {!p.published && (
                    <span className="ml-2 text-xs text-amber-600">draft — hidden from members</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/admin/collections" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Collections
      </Link>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-3xl font-bold tracking-tight">{collection.title}</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {collection.kind === "smart" ? "Smart" : "Manual"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <form action={setCollectionPublished}>
            <input type="hidden" name="id" value={collection.id} />
            <input type="hidden" name="publish" value={published ? "false" : "true"} />
            <button type="submit" className="text-sm font-medium text-zinc-600 hover:underline">
              {published ? "Unpublish" : "Publish"}
            </button>
          </form>
          <DeleteCollectionButton id={collection.id} title={collection.title} />
        </div>
      </div>

      <form action={updateCollection} className="mt-8 space-y-4">
        <input type="hidden" name="id" value={collection.id} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Title</span>
          <input name="title" defaultValue={collection.title} required className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">Description</span>
          <textarea name="description" rows={2} defaultValue={collection.description} className={inputCls} />
        </label>
        {collection.kind === "smart" ? (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Match</span>
            <select name="matchMode" defaultValue={collection.matchMode} className={inputCls}>
              <option value="any">Any tag (broad)</option>
              <option value="all">All tags (narrow)</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="matchMode" value={collection.matchMode} />
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-700">
            Max classes shown
          </span>
          <input
            name="displayLimit"
            type="number"
            min={1}
            placeholder="No limit"
            defaultValue={collection.displayLimit ?? ""}
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-zinc-400">
            Caps how many classes appear in this row on the browse page. Leave blank for no limit.
          </span>
        </label>
        {collection.kind === "manual" && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="autoAddNew"
              defaultChecked={collection.autoAddNew}
              className="mt-0.5"
            />
            <span className="text-sm text-zinc-700">
              Automatically add new classes to the top of this collection
            </span>
          </label>
        )}
        <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700">
          Save details
        </button>
      </form>

      <hr className="my-8 border-zinc-200" />

      {body}
    </div>
  );
}
