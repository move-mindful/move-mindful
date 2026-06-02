"use client";

import { useState } from "react";
import { deleteClass } from "@/app/actions/classes";

export function DeleteClassButton({
  id,
  hasMuxAsset,
}: {
  id: string;
  hasMuxAsset: boolean;
}) {
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
            <h3 className="text-lg font-semibold">Delete this class?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              This removes the class from the catalog and any collections. This
              cannot be undone.
            </p>
            <form action={deleteClass} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={id} />
              {hasMuxAsset && (
                <label className="flex items-start gap-2 text-sm text-zinc-700">
                  <input type="checkbox" name="deleteFromMux" className="mt-0.5" />
                  <span>
                    Also delete the video from Mux (permanent — removes the source
                    file)
                  </span>
                </label>
              )}
              <div className="flex justify-end gap-3">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
