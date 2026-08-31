"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { MuxPlayer } from "@/components/mux-player";

/**
 * A routine's still, with a Preview control over it that opens the clip.
 *
 * The clip is its own short Mux asset (`previewPlaybackId`), never the class
 * with a stop time — see the note on that field in lib/products.ts. Nothing
 * here can reach the full video.
 *
 * Without a preview id this is just the image, so the control appears only on
 * the routines that have one and the rest are unaffected.
 *
 * A native <dialog>: Escape, the top layer and inert-ing the page behind come
 * free, which is most of what makes a hand-rolled modal go wrong.
 */
export function RoutinePreview({
  image,
  alt,
  title,
  previewPlaybackId,
  className = "",
}: {
  image: string;
  alt: string;
  title: string;
  previewPlaybackId?: string;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // `close` also fires for Escape, so unmounting the player hangs off the
    // event rather than off the button — otherwise Escape leaves it playing.
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const picture = (
    <Image
      src={image}
      alt={alt}
      width={1600}
      height={1067}
      sizes="(min-width: 640px) 220px, 100vw"
      className="h-[150px] w-full rounded-xl object-cover sm:h-[140px] sm:rounded-[14px]"
    />
  );

  if (!previewPlaybackId) {
    return <div className={className}>{picture}</div>;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className="group relative block w-full cursor-pointer overflow-hidden rounded-xl sm:rounded-[14px]"
        aria-label={`Preview ${title}`}
      >
        {picture}
        <span className="absolute inset-0 bg-black/15 transition group-hover:bg-black/30" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-semibold text-[#14142B] shadow-sm transition group-hover:bg-white">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 1.2v9.6L10.2 6z" fill="currentColor" />
            </svg>
            Preview
          </span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          // The dialog element fills the viewport, so a click landing on it
          // rather than on its contents is a click on the backdrop.
          if (e.target === dialogRef.current) close();
        }}
        className="w-[min(56rem,92vw)] rounded-2xl bg-black p-0 backdrop:bg-black/70 open:animate-none"
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>
        {/* Mounted only while open so closing actually stops playback, and so
            the player isn't loaded for a preview nobody opens. */}
        {open && (
          <MuxPlayer
            playbackId={previewPlaybackId}
            title={`${title} — preview`}
            autoPlay
          />
        )}
      </dialog>
    </div>
  );
}
