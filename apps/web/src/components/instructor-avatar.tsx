import Image from "next/image";

/**
 * Circular instructor avatar. Shows the uploaded photo when present, otherwise a
 * single-initial fallback circle. `size` is the rendered diameter in pixels.
 */
export function InstructorAvatar({
  name,
  src,
  size = 24,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {initial}
    </span>
  );
}
