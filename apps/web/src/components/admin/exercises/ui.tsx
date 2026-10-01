"use client";

import type { ReactNode } from "react";

// Small shared pieces for the exercise admin screens.

export function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** A toggle pill: equipment, dumbbell levels, tags, filters. */
export function Pill({
  on,
  onClick,
  small,
  children,
}: {
  on: boolean;
  onClick: () => void;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border font-semibold transition ${
        small ? "h-8 px-3 text-sm" : "h-9 px-3.5 text-sm"
      } ${
        on
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside && <span className="text-sm text-zinc-500">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

const flagStyles: Record<string, string> = {
  Processing: "bg-violet-100 text-violet-700",
  "Upload failed": "bg-red-100 text-red-700",
  "No tutorial": "bg-amber-100 text-amber-800",
  "Missing clip": "bg-amber-100 text-amber-800",
  "R + L": "bg-violet-100 text-violet-700",
  "Warm-up": "bg-zinc-100 text-zinc-600",
  "Cool-down": "bg-zinc-100 text-zinc-600",
  Archived: "bg-zinc-100 text-zinc-600",
};

export function Flag({ children }: { children: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        flagStyles[children] ?? "bg-zinc-100 text-zinc-600"
      }`}
    >
      {children}
    </span>
  );
}
