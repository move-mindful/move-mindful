"use client";

import { useRef } from "react";
import Image from "next/image";

/**
 * Shrink a cover photo to at most `max` px on its long edge and re-encode it as
 * WebP, so a phone-camera original doesn't slow the member's preview screen.
 */
export async function resizeCover(file: File, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = document.createElement("img");
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.85));
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CoverField({
  url,
  busy,
  onPick,
  onRemove,
}: {
  url: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={url ? "Replace cover image" : "Upload a cover image"}
        className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-xs font-medium text-zinc-500"
      >
        {url ? <Image src={url} alt="" fill unoptimized className="object-cover" /> : "Upload cover"}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-zinc-700">Uploading…</span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
      <div className="space-y-2 text-sm">
        <p className="font-medium text-zinc-600">Cover image</p>
        <p className="text-zinc-500">
          Shown at the top of the workout preview. It’s cropped to fit phones and desktops, so keep the subject near the
          middle.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50"
          >
            {url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button type="button" onClick={onRemove} disabled={busy} className="text-xs font-semibold text-zinc-600 hover:underline">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
