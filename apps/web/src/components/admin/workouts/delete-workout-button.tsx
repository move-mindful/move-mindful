"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkout } from "@/app/actions/workouts";

/** Delete, on a row of the admin workouts list: asks first, as the builder does. */
export function DeleteWorkoutButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) return;
    setBusy(true);
    const res = await deleteWorkout(id);
    setBusy(false);
    if (res.error) window.alert(res.error);
    else router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="text-red-600 transition hover:text-red-800 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
