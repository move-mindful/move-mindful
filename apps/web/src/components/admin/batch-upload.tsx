"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createUpload } from "@mux/upchunk";
import { createMuxDirectUploads } from "@/app/actions/uploads";

type ItemStatus = "pending" | "uploading" | "done" | "error";

interface UploadItem {
  file: File;
  progress: number; // 0–100
  status: ItemStatus;
  error?: string;
}

// Cap parallel uploads so a big batch on a slow connection doesn't saturate the
// uplink and stall everything. The rest queue and start as slots free up.
const MAX_CONCURRENT = 3;
const MAX_FILES = 50;

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

export function BatchUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const allDone =
    items.length > 0 &&
    items.every((it) => it.status === "done" || it.status === "error");
  const succeeded = items.filter((it) => it.status === "done").length;
  const failed = items.filter((it) => it.status === "error").length;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setSetupError(null);
    setItems(
      picked
        .slice(0, MAX_FILES)
        .map((file) => ({ file, progress: 0, status: "pending" as const })),
    );
  }

  function reset() {
    setItems([]);
    setSetupError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function uploadOne(index: number, file: File, url: string): Promise<void> {
    return new Promise((resolve) => {
      setItems((prev) =>
        prev.map((it, i) =>
          i === index ? { ...it, status: "uploading", progress: 0 } : it,
        ),
      );

      const upload = createUpload({ endpoint: url, file });

      upload.on("progress", (e) => {
        const pct = Math.round((e.detail as number) ?? 0);
        setItems((prev) =>
          prev.map((it, i) => (i === index ? { ...it, progress: pct } : it)),
        );
      });
      upload.on("success", () => {
        setItems((prev) =>
          prev.map((it, i) =>
            i === index ? { ...it, status: "done", progress: 100 } : it,
          ),
        );
        resolve();
      });
      upload.on("error", (e) => {
        const message =
          (e.detail && (e.detail.message as string)) || "Upload failed.";
        setItems((prev) =>
          prev.map((it, i) =>
            i === index ? { ...it, status: "error", error: message } : it,
          ),
        );
        // Resolve (not reject) so one bad file doesn't abort the rest of the batch.
        resolve();
      });
    });
  }

  async function start() {
    if (items.length === 0 || busy) return;
    setBusy(true);
    setSetupError(null);

    const files = items.map((it) => it.file);
    const { uploads, error } = await createMuxDirectUploads(files.map((f) => f.name));
    if (error || uploads.length !== files.length) {
      setSetupError(error ?? "Could not start the upload. Try again.");
      setBusy(false);
      return;
    }

    // A simple worker pool: each worker pulls the next index until the list is done.
    let cursor = 0;
    async function worker() {
      while (cursor < files.length) {
        const index = cursor++;
        await uploadOne(index, files[index], uploads[index].url);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT, files.length) }, worker),
    );

    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={onPick}
        disabled={busy}
        className="hidden"
      />

      {!allDone && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {items.length > 0 ? "Choose different files" : "Choose video files"}
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy
                ? "Uploading…"
                : `Upload ${items.length} video${items.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}

      {items.length === 0 && !allDone && (
        <p className="text-sm text-zinc-500">
          Pick one or more video files — hold ⌘ (or Shift) in the file browser to
          select several at once.
        </p>
      )}

      {setupError && <p className="text-sm text-red-600">{setupError}</p>}

      {items.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200">
          {items.map((it, i) => (
            <li key={`${it.file.name}-${i}`} className="flex flex-col gap-1.5 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">
                  {it.file.name}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {it.status === "done"
                    ? "Done"
                    : it.status === "error"
                      ? "Failed"
                      : it.status === "uploading"
                        ? `${it.progress}%`
                        : formatSize(it.file.size)}
                </span>
              </div>
              {it.status !== "error" && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      it.status === "done" ? "bg-emerald-500" : "bg-zinc-900"
                    }`}
                    style={{ width: `${it.progress}%` }}
                  />
                </div>
              )}
              {it.status === "error" && (
                <p className="text-xs text-red-600">{it.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {allDone && (
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {succeeded > 0 && (
              <p>
                {succeeded} video{succeeded === 1 ? "" : "s"} uploaded. Mux is now
                encoding {succeeded === 1 ? "it" : "them"} — once ready,{" "}
                {succeeded === 1 ? "it shows" : "they show"} up in Import.
              </p>
            )}
            {failed > 0 && (
              <p className={succeeded > 0 ? "mt-1 text-red-700" : "text-red-700"}>
                {failed} file{failed === 1 ? "" : "s"} failed to upload.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/classes/import"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Go to Import
            </Link>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-50"
            >
              Upload more
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
