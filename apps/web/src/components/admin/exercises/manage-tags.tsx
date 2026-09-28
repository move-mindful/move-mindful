"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExerciseTag, deleteExerciseTag, renameExerciseTag } from "@/app/actions/exercises";
import type { ExerciseTag } from "@/lib/exercises/shared";

/** The library's "Manage tags" panel: rename, delete (with a count) and add. */
export function ManageTags({
  tags,
  onClose,
  onDeleted,
}: {
  tags: ExerciseTag[];
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function saveRename(id: string) {
    const { error } = await renameExerciseTag(id, draft);
    if (error) return setError(error);
    setEditing(null);
    setError(null);
    router.refresh();
  }

  async function remove(id: string) {
    await deleteExerciseTag(id);
    setConfirming(null);
    onDeleted(id);
    router.refresh();
  }

  async function add() {
    if (!newTag.trim()) return;
    const { error } = await createExerciseTag(newTag);
    if (error) return setError(error);
    setNewTag("");
    setError(null);
    router.refresh();
  }

  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100";

  return (
    <div
      role="dialog"
      aria-label="Manage tags"
      className="absolute right-0 top-full z-20 mt-2 w-[400px] space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">Exercise tags</p>
          <p className="text-xs text-zinc-500">Only used to filter this library</p>
        </div>
        <button aria-label="Close" onClick={onClose} className={iconBtn}>
          ×
        </button>
      </div>

      <ul className="space-y-0.5">
        {tags.map((t) => (
          <li key={t.id}>
            {editing === t.id ? (
              <div className="flex h-10 items-center gap-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(t.id)}
                  aria-label={`New name for ${t.name}`}
                  className="h-8 min-w-0 flex-1 rounded-md border border-zinc-500 px-2 text-sm focus:outline-none"
                />
                <button onClick={() => saveRename(t.id)} className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white">
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="h-8 px-2 text-sm font-semibold text-zinc-600">
                  Cancel
                </button>
              </div>
            ) : confirming === t.id ? (
              <div className="my-1 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-zinc-700">
                  Delete <span className="font-semibold text-zinc-900">{t.name}</span>?{" "}
                  {t.count ? `It comes off ${t.count} exercise${t.count === 1 ? "" : "s"}.` : "Nothing uses it."} The
                  exercises themselves aren’t changed.
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setConfirming(null)} className="h-8 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold">
                    Cancel
                  </button>
                  <button onClick={() => remove(t.id)} className="h-8 rounded-md bg-red-600 px-3 text-sm font-semibold text-white">
                    Delete tag
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-10 items-center gap-1 rounded-lg pl-2.5 hover:bg-zinc-50">
                <span className="flex-1 text-sm font-medium">{t.name}</span>
                <span className="mr-1.5 text-xs text-zinc-500">
                  {t.count ? `${t.count} exercise${t.count === 1 ? "" : "s"}` : "Not used"}
                </span>
                <button
                  aria-label={`Rename ${t.name}`}
                  onClick={() => {
                    setEditing(t.id);
                    setDraft(t.name);
                    setConfirming(null);
                  }}
                  className={iconBtn}
                >
                  ✎
                </button>
                <button
                  aria-label={`Delete ${t.name}`}
                  onClick={() => {
                    setConfirming(t.id);
                    setEditing(null);
                  }}
                  className={iconBtn}
                >
                  🗑
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-t border-zinc-100 pt-3">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="New tag name"
          aria-label="New tag name"
          className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-sm focus:border-zinc-500 focus:outline-none"
        />
        <button onClick={add} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-50">
          Add tag
        </button>
      </div>
    </div>
  );
}
