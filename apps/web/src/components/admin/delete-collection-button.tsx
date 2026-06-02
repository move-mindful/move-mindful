"use client";

import { useState } from "react";
import { deleteCollection } from "@/app/actions/collections";

export function DeleteCollectionButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-red-600 hover:underline"
      >
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Delete collection “{title}”?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              This removes the collection and its ordering/rule. The classes
              themselves are not deleted.
            </p>
            <form action={deleteCollection} className="mt-5 flex justify-end gap-3">
              <input type="hidden" name="id" value={id} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
