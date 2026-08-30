"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * The hero: a still that a muted loop fades in over once it's playing.
 *
 * Layered rather than swapped so the still is still the thing that paints
 * first — it's the largest element on the page, optimised by next/image and
 * marked priority, and the video only mounts after hydration. That ordering is
 * deliberate: a hero video that blocks first paint costs more than it adds.
 *
 * A plain <video> rather than Mux Player. It's decorative, so the player's
 * controls and keyboard handling are dead weight — and every mount would
 * register a view in Mux Data, turning "how many people watched this class"
 * into "how many people loaded the sales page".
 *
 * Anyone who has asked their system for less motion keeps the still.
 */
export function HeroMedia({
  poster,
  alt,
  videoSrc,
  className = "",
  imageSizes,
}: {
  poster: string;
  alt: string;
  /** Omit to render the still alone. */
  videoSrc?: string;
  className?: string;
  imageSizes?: string;
}) {
  const [motionOk, setMotionOk] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <div
      // 16:9, matching the footage — a wider band would crop the top and
      // bottom off a standing figure.
      className={`relative aspect-video w-full overflow-hidden rounded-[20px] bg-[#F2F0FE] sm:rounded-[24px] ${className}`}
    >
      <Image
        src={poster}
        alt={alt}
        fill
        priority
        sizes={imageSizes}
        className="object-cover"
      />

      {videoSrc && motionOk && (
        <video
          src={videoSrc}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // Decorative: the still underneath already carries the alt text.
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            playing ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
