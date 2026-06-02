"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  createInstructor,
  updateInstructor,
  deleteInstructor,
} from "@/app/actions/instructors";
import { InstructorAvatar } from "@/components/instructor-avatar";
import type { AdminInstructor } from "@/lib/admin/queries";

const inputCls =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none";
const fileCls =
  "block text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200";

/** Center-crop to a square and re-encode as a small WebP so avatars stay light. */
async function resizeToSquare(file: File, size = 512): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = document.createElement("img");
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - min) / 2;
    const sy = (img.naturalHeight - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.85),
    );
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Replace the form's raw file with a resized WebP (or drop it if none chosen).
async function attachAvatar(fd: FormData, file: File | undefined) {
  if (!file || file.size === 0) {
    fd.delete("avatar");
    return;
  }
  try {
    fd.set("avatar", await resizeToSquare(file), "avatar.webp");
  } catch {
    fd.set("avatar", file, file.name); // fallback: upload the original
  }
}

function fileFrom(form: HTMLFormElement): File | undefined {
  return (form.elements.namedItem("avatar") as HTMLInputElement | null)?.files?.[0];
}

export function InstructorManager({ instructors }: { instructors: AdminInstructor[] }) {
  const [editing, setEditing] = useState<AdminInstructor | null>(null);
  const [deleting, setDeleting] = useState<AdminInstructor | null>(null);
  const [addPreview, setAddPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    await attachAvatar(fd, fileFrom(form));
    await createInstructor(fd);
    setBusy(false);
    form.reset();
    setAddPreview(null);
  }

  async function handleEditSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    await attachAvatar(fd, fileFrom(form));
    await updateInstructor(fd);
    setBusy(false);
    setEditing(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const fd = new FormData();
    fd.set("id", deleting.id);
    setBusy(true);
    await deleteInstructor(fd);
    setBusy(false);
    setDeleting(null);
  }

  return (
    <div className="space-y-6">
      {/* Add */}
      <form onSubmit={handleAdd} className="rounded-xl border border-zinc-200 p-4">
        <h2 className="text-lg font-semibold">Add instructor</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">First name</span>
            <input name="name" required placeholder="e.g. Sarah" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Photo</span>
            <input
              name="avatar"
              type="file"
              accept="image/*"
              onChange={(e) =>
                setAddPreview(
                  e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null,
                )
              }
              className={fileCls}
            />
          </label>
          {addPreview && (
            // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview
            <img
              src={addPreview}
              alt="Preview"
              className="h-12 w-12 rounded-full object-cover"
            />
          )}
          <button
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {instructors.length === 0 && (
          <p className="px-4 py-6 text-sm text-zinc-400">No instructors yet.</p>
        )}
        {instructors.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-4 py-3">
            <InstructorAvatar name={i.name} src={i.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.name}</p>
              <p className="text-xs text-zinc-400">
                {i.classCount} class{i.classCount !== 1 && "es"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(i)}
              aria-label={`Edit ${i.name}`}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleting(i)}
              aria-label={`Delete ${i.name}`}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <form onSubmit={handleEditSave}>
            <input type="hidden" name="id" value={editing.id} />
            <h3 className="text-lg font-semibold">Edit instructor</h3>
            <label className="mt-4 block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">First name</span>
              <input name="name" defaultValue={editing.name} required className={inputCls} />
            </label>
            <div className="mt-4 flex items-center gap-3">
              <InstructorAvatar name={editing.name} src={editing.avatarUrl} size={48} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-700">
                  Replace photo
                </span>
                <input name="avatar" type="file" accept="image/*" className={fileCls} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete modal */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <h3 className="text-lg font-semibold">Delete “{deleting.name}”?</h3>
          <p className="mt-2 text-sm text-zinc-500">
            {deleting.classCount > 0
              ? `Assigned to ${deleting.classCount} class${
                  deleting.classCount !== 1 ? "es" : ""
                }, which will be left without an instructor.`
              : "Not assigned to any classes."}{" "}
            Their photo will be removed. This cannot be undone.
          </p>
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
              disabled={busy}
              onClick={confirmDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
