"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareClassDownload } from "@/app/actions/classes";

type DownloadStatus =
  | "not_requested"
  | "preparing"
  | "ready"
  | "errored"
  | "unavailable";

interface DownloadInfo {
  status: DownloadStatus;
  url: string | null;
  error?: string;
}

type LocalDownloadInfo = DownloadInfo & {
  classId: string;
  initialStatus: DownloadStatus;
  initialUrl: string | null;
};

const primaryCls =
  "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50";
const secondaryCls =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition hover:bg-white disabled:opacity-50";

export function ClassDownloadControl({
  classId,
  title,
  initialStatus,
  initialUrl,
}: {
  classId: string;
  title: string;
  initialStatus: DownloadStatus;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [download, setDownload] = useState<LocalDownloadInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const current: DownloadInfo =
    download?.classId === classId &&
    download.initialStatus === initialStatus &&
    download.initialUrl === initialUrl
      ? download
      : { status: initialStatus, url: initialUrl };
  const pending = busy || refreshing;
  const filename = `${safeFilename(title)}.mp4`;
  const downloadUrl =
    current.status === "ready" && current.url
      ? withDownloadFilename(current.url, filename)
      : null;

  async function handlePrepare() {
    setBusy(true);
    try {
      const next = await prepareClassDownload(classId);
      setDownload({ ...next, classId, initialStatus, initialUrl });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-700">Admin download</p>
          <p className="mt-1 text-xs text-zinc-500" aria-live="polite">
            {statusText(current)}
          </p>
          {current.error && (
            <p className="mt-1 text-xs text-red-600" aria-live="polite">
              {current.error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className={primaryCls}
            >
              Download MP4
            </a>
          )}
          {current.status === "preparing" ? (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={pending}
              className={secondaryCls}
            >
              {pending ? "Checking..." : "Refresh status"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePrepare}
              disabled={pending}
              className={downloadUrl ? secondaryCls : primaryCls}
            >
              {pending
                ? "Preparing..."
                : current.status === "ready"
                  ? "Prepare fresh link"
                  : current.status === "errored"
                    ? "Try again"
                    : "Prepare download"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function statusText(download: DownloadInfo) {
  if (download.status === "ready" && download.url) {
    return "MP4 ready. The temporary Mux link expires after 24 hours.";
  }
  if (download.status === "ready") {
    return "Mux says the MP4 is ready, but no download URL was returned.";
  }
  if (download.status === "preparing") return "Mux is preparing the MP4.";
  if (download.status === "errored") return "Mux could not prepare this MP4.";
  if (download.status === "unavailable") return "Download status is unavailable.";
  return "No MP4 download prepared yet.";
}

function safeFilename(title: string) {
  const slug = title
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "class";
}

function withDownloadFilename(url: string, filename: string) {
  try {
    const muxUrl = new URL(url);
    muxUrl.searchParams.set("download", filename);
    return muxUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}download=${encodeURIComponent(filename)}`;
  }
}
