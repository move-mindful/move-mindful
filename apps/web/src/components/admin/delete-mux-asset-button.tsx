"use client";

import { useState } from "react";
import { deleteMuxAsset } from "@/app/actions/classes";

export function DeleteMuxAssetButton({
  assetId,
  title,
}: {
  assetId: string;
  title: string;
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
            <h3 className="text-lg font-semibold">Delete this video from Mux?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              This permanently deletes{" "}
              <span className="font-medium">{title || "this asset"}</span> from
              Mux. It hasn&rsquo;t been imported as a class, so nothing in the
              catalog is affected. This cannot be undone.
            </p>
            <form action={deleteMuxAsset} className="mt-4 space-y-4">
              <input type="hidden" name="assetId" value={assetId} />
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
                  Delete from Mux
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
