"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pause } from "./icons";

/**
 * The first-run guide to the player's gestures, over the stage on phones: two
 * pages — tapping (the three zones drawn over the video) and swiping. Shown
 * once, as the first exercise comes up (see guidePending in the core
 * reducer), and again from Settings. The workout waits while it's open.
 */
export function GestureGuide({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState<0 | 1>(0);

  return (
    <div className="absolute inset-0 z-30 flex flex-col" role="dialog" aria-modal="true" aria-label="How to use the player">
      {page === 0 ? (
        // The three tap zones, drawn where they are.
        <div className="relative flex flex-1" aria-hidden="true">
          <Zone tint="rgba(76,199,224,0.32)" divider>
            <Tag>
              <ChevronLeft size={16} />
              Back
            </Tag>
          </Zone>
          <Zone tint="rgba(255,255,255,0.14)" divider>
            <Tag dark>
              <Pause size={14} />
              Pause
            </Tag>
          </Zone>
          <Zone tint="rgba(169,156,255,0.32)">
            <Tag>
              Next
              <ChevronRight size={16} />
            </Tag>
          </Zone>
        </div>
      ) : (
        // Swipes: up and down, in the middle.
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#080814]/60" aria-hidden="true">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/[0.16]">
            <ArrowUp size={26} />
          </span>
          <span className="flex size-14 items-center justify-center rounded-full bg-white/[0.16]">
            <ArrowDown size={26} />
          </span>
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-t-[28px] bg-[#1A1A34] px-5 pb-[max(28px,calc(env(safe-area-inset-bottom)+12px))] pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/60">How it works · {page + 1} of 2</span>
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{page === 0 ? "Tap to move around" : "Swipe for more"}</h2>
        </div>
        {page === 0 ? (
          <div className="flex flex-col gap-3.5">
            <Row icon={<ChevronLeft size={20} />} tint="bg-[#4CC7E0]/25 text-[#8BE3F2]" title="Tap the left side" text="Go back." />
            <Row icon={<Pause size={18} />} tint="bg-white/[0.14]" title="Tap the middle" text="Pause. Press play to resume." />
            <Row icon={<ChevronRight size={20} />} tint="bg-[#A99CFF]/25 text-[#C9C0FF]" title="Tap the right side" text="Move on." />
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <Row icon={<ArrowUp size={18} />} tint="bg-white/[0.14]" title="Swipe up" text="See the whole workout." />
            <Row icon={<ArrowDown size={18} />} tint="bg-white/[0.14]" title="Swipe down" text="Close it again." />
            <Row
              icon={<ArrowDown size={18} />}
              tint="bg-white/[0.14]"
              title="Swipe down again"
              text="Hide the controls so only the reps show."
            />
            <Row icon={<ArrowUp size={18} />} tint="bg-white/[0.14]" title="Swipe up" text="Bring the controls back." />
          </div>
        )}
        <div className="mt-1 flex items-center gap-3">
          {page === 0 && (
            <button type="button" onClick={onDone} className="h-[54px] px-4 text-base font-semibold text-white/75">
              Skip
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => (page === 0 ? setPage(1) : onDone())}
            className="h-[54px] flex-1 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
          >
            {page === 0 ? "Next" : "Got it"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Zone({ tint, divider = false, children }: { tint: string; divider?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex flex-1 items-center justify-center ${divider ? "border-r-2 border-dashed border-white/80" : ""}`}
      style={{ background: tint }}
    >
      {children}
    </div>
  );
}

function Tag({ dark = false, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.2)] ${
        dark ? "bg-[#14142B] text-white" : "bg-white text-[#14142B]"
      }`}
    >
      {children}
    </span>
  );
}

function Row({ icon, tint, title, text }: { icon: ReactNode; tint: string; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-white/70">{text}</span>
      </span>
    </div>
  );
}
