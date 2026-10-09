"use client";

import Image from "next/image";
import { useUser } from "@clerk/nextjs";

/**
 * The signed-in member's profile photo, from their Clerk account — the
 * sidebar's Account item and the phone header's link to Account. Their initial
 * when they haven't added a photo (Clerk always has an imageUrl, but without
 * `hasImage` it's a generated placeholder).
 */
export function MemberAvatar({ size }: { size: number }) {
  const { user } = useUser();

  if (user?.hasImage) {
    return (
      <Image
        src={user.imageUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-2 ring-violet-500 ring-offset-2 ring-offset-background"
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = (
    user?.firstName?.[0] ||
    user?.primaryEmailAddress?.emailAddress[0] ||
    ""
  ).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ring-2 ring-violet-500 ring-offset-2 ring-offset-background dark:bg-zinc-700 dark:text-zinc-200"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initial}
    </span>
  );
}
