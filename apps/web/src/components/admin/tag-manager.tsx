"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import {
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  createTag,
  updateTag,
  deleteTag,
} from "@/app/actions/tags";
import type { TagsAdminData, AdminTagUsage } from "@/lib/admin/queries";

type Editing = { kind: "group" | "tag"; id: string } | null;
type Deleting =
  | { kind: "group"; id: string; name: string; tagCount: number }
  | {
      kind: "tag";
      id: string;
      name: string;
      classCount: number;
      collectionCount: number;
    }
  | null;

const inputCls =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none";

export function TagManager({ data }: { data: TagsAdminData }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);

  const isEditing = (kind: "group" | "tag", id: string) =>
    editing?.kind === kind && editing.id === id;

  async function renameGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await updateTagGroup(new FormData(e.currentTarget));
    setEditing(null);
  }

  async function renameTag(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await updateTag(new FormData(e.currentTarget));
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const fd = new FormData();
    fd.set("id", deleting.id);
    if (deleting.kind === "group") await deleteTagGroup(fd);
    else await deleteTag(fd);
    setDeleting(null);
  }

  function renderTags(tags: AdminTagUsage[]) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.length === 0 && (
          <span className="text-sm text-zinc-400">No tags yet.</span>
        )}
        {tags.map((t) =>
          isEditing("tag", t.id) ? (
            <form key={t.id} onSubmit={renameTag} className="flex items-center gap-1">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} autoFocus className={inputCls} />
              <IconBtn type="submit">
                <Check className="h-4 w-4" />
              </IconBtn>
              <IconBtn type="button" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </IconBtn>
            </form>
          ) : (
            <span
              key={t.id}
              className="group flex items-center gap-1.5 rounded-full border border-zinc-300 py-1 pl-3 pr-1.5 text-sm"
            >
              {t.name}
              <button
                type="button"
                onClick={() => setEditing({ kind: "tag", id: t.id })}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label={`Rename ${t.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeleting({
                    kind: "tag",
                    id: t.id,
                    name: t.name,
                    classCount: t.classCount,
                    collectionCount: t.collectionCount,
                  })
                }
                className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete ${t.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ),
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={createTagGroup} className="flex gap-2">
        <input
          name="name"
          placeholder="New group (e.g. Focus, Vibe)"
          required
          className={`${inputCls} flex-1`}
        />
        <button className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700">
          Add group
        </button>
      </form>

      {data.groups.map((g) => (
        <section key={g.id} className="rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between gap-2">
            {isEditing("group", g.id) ? (
              <form onSubmit={renameGroup} className="flex items-center gap-1">
                <input type="hidden" name="id" value={g.id} />
                <input name="name" defaultValue={g.name} autoFocus className={inputCls} />
                <IconBtn type="submit">
                  <Check className="h-4 w-4" />
                </IconBtn>
                <IconBtn type="button" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </IconBtn>
              </form>
            ) : (
              <h2 className="text-lg font-semibold">{g.name}</h2>
            )}
            {!isEditing("group", g.id) && (
              <div className="flex items-center gap-1">
                <IconBtn type="button" onClick={() => setEditing({ kind: "group", id: g.id })}>
                  <Pencil className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  type="button"
                  onClick={() =>
                    setDeleting({ kind: "group", id: g.id, name: g.name, tagCount: g.tags.length })
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </IconBtn>
              </div>
            )}
          </div>

          {renderTags(g.tags)}

          <form action={createTag} className="mt-3 flex gap-2">
            <input type="hidden" name="groupId" value={g.id} />
            <input
              name="name"
              placeholder={`Add tag to ${g.name}`}
              required
              className={`${inputCls} flex-1`}
            />
            <button
              className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-50"
              aria-label="Add tag"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </section>
      ))}

      <section className="rounded-xl border border-dashed border-zinc-300 p-4">
        <h2 className="text-lg font-semibold text-zinc-600">Ungrouped</h2>
        {renderTags(data.ungrouped)}
        <form action={createTag} className="mt-3 flex gap-2">
          <input
            name="name"
            placeholder="Add ungrouped tag"
            required
            className={`${inputCls} flex-1`}
          />
          <button
            className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-zinc-50"
            aria-label="Add tag"
          >
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </section>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {deleting.kind === "group" ? (
              <>
                <h3 className="text-lg font-semibold">Delete group “{deleting.name}”?</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Its {deleting.tagCount} tag{deleting.tagCount !== 1 && "s"} will become
                  ungrouped (not deleted).
                </p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">Delete tag “{deleting.name}”?</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Used by {deleting.classCount} class
                  {deleting.classCount !== 1 && "es"} · {deleting.collectionCount} collection
                  {deleting.collectionCount !== 1 && "s"}. It will be removed from them. This
                  cannot be undone.
                </p>
              </>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children,
  type,
  onClick,
}: {
  children: React.ReactNode;
  type: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
    >
      {children}
    </button>
  );
}
