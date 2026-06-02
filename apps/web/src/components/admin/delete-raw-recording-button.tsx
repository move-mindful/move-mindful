"use client";

import { useState } from "react";
import { deleteRawRecording } from "@/app/actions/classes";

export function DeleteRawRecordingButton({
  id,
  ready,
}: {
  id: string;
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!ready) {
    return (
      <p className="text-sm text-amber-600">
        Clip is still processing in Mux — reload in a moment to delete the
        original.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-red-600 hover:underline"
      >
        Delete raw recording
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Delete the original recording?</h3>
            <p className="mt-2 text-sm text-zinc-500">
              This permanently deletes the full, untrimmed recording from Mux. The
              trimmed clip your members watch is a separate asset and is not
              affected. This cannot be undone.
            </p>
            <form action={deleteRawRecording} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={id} />
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
                  Delete original
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
