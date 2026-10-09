"use client";

import Link from "next/link";
import { useMemo } from "react";
import { aboutMinutes, type WorkoutStep } from "@move-mindful/core";
import { equipmentPills, exerciseLineup, levelLabel, type PlayerWorkout } from "@/lib/workouts/player";
import { DoneLabel } from "./done-label";
import { ArrowRight, Check, ChevronLeft, EQUIPMENT_ICONS, RestartWorkout } from "./icons";
import { Switch } from "./player-screens";
import { WorkoutRows } from "./workout-rows";
import { WorkoutMontage } from "./workout-montage";

/**
 * The screen before a workout: cover, what it is, what you'll need and the
 * whole sequence. On a phone it scrolls under the cover with Begin pinned to
 * the bottom; on desktop (the `theater` variant) the cover fills the left half
 * with the details over it, and the sequence gets the right half.
 */
export function WorkoutPreview({
  workout,
  steps,
  totalSeconds,
  exerciseCount,
  backHref,
  warmup,
  onWarmup,
  onBegin,
  resume,
  onResume,
  doneAt = null,
}: {
  workout: PlayerWorkout;
  steps: WorkoutStep[];
  totalSeconds: number;
  exerciseCount: number;
  backHref: string;
  /** Begin with the warm-up (the member's setting, shown as the switch beside Begin). */
  warmup: boolean;
  onWarmup: (on: boolean) => void;
  onBegin: (withWarmup: boolean) => void;
  /** Saved progress to pick up: the set it resumes at, how far along, and whether it began with the warm-up. */
  resume: { step: number; percent: number; warmedUp: boolean } | null;
  onResume: () => void;
  /** When the member last finished it, for the "Done · 3 days ago" pill; null if never. */
  doneAt?: string | null;
}) {
  const level = levelLabel(workout.level);
  const pills = equipmentPills(workout);
  // One clip per exercise, even across sets, rounds and left/right sides.
  const clips = useMemo(() => exerciseLineup(steps, workout.exercises).map((x) => x.clip), [steps, workout.exercises]);
  const cover = workout.coverImageUrl ?? clips[0]?.poster ?? null;
  const canStart = steps.length > 0;

  const begin = (
    <BeginRow
      workout={workout}
      canStart={canStart}
      warmup={warmup}
      onWarmup={onWarmup}
      onBegin={onBegin}
      resume={resume}
      onResume={onResume}
    />
  );

  return (
    // The site's dark-mode background (#0C1014, globals.css), with the profile
    // photo's ring violet (violet-500) as the accent — the design canvas's
    // "Dark mode · violet accent" row (Oct 2026). The player keeps its own
    // ink and lavender for now.
    // data-no-page-scrollbar: the page scrolls without showing a scroll bar (globals.css).
    <div data-no-page-scrollbar className="relative min-h-dvh bg-[#0C1014] text-white">
      {/* Back sits at the top of the page and scrolls away with it (above the
          pinned cover); on desktop it stays put over the fixed left half. */}
      <Link
        href={backHref}
        aria-label="Back"
        className="absolute left-4 top-5 z-20 theater:fixed flex size-11 items-center justify-center rounded-full bg-[#0C1014]/50 backdrop-blur-md theater:left-12 theater:top-8 theater:w-auto theater:gap-1 theater:pl-3 theater:pr-[18px]"
      >
        <ChevronLeft />
        <span className="hidden text-[15px] font-semibold theater:inline">Back</span>
      </Link>
      <div className="mx-auto max-w-[560px] pb-32 theater:max-w-none theater:pb-0">
        {/* The cover — on phones pinned at the top while the page scrolls up
            over it; on desktop, the whole left half, with the details over it.
            On phones about half the screen (330 to 460pt; was 330, Oct 2026),
            so more of the video shows above the details — the same height as
            (player)/loading.tsx's. */}
        <div className="sticky top-0 h-[clamp(330px,52svh,460px)] overflow-hidden theater:fixed theater:inset-y-0 theater:left-0 theater:h-auto theater:w-1/2">
          <WorkoutMontage key={workout.id} clips={clips} cover={cover} />
          {/* Phones: just a light shade at the top (the fade into the page
              travels with the content below, so it stays soft as it scrolls). */}
          <div
            className="absolute inset-0 theater:hidden"
            style={{ background: "linear-gradient(180deg, rgba(12,16,20,0.25) 0%, rgba(12,16,20,0) 22%)" }}
          />
          <div
            className="absolute inset-0 hidden theater:block"
            style={{
              background:
                "linear-gradient(180deg, rgba(12,16,20,0.45) 0%, rgba(12,16,20,0) 16%, rgba(12,16,20,0.2) 34%, rgba(12,16,20,0.86) 56%, #0C1014 72%), linear-gradient(90deg, rgba(12,16,20,0) 72%, #0C1014 100%)",
            }}
          />

          <div className="hidden theater:absolute theater:bottom-[72px] theater:left-20 theater:right-16 theater:flex theater:max-w-[576px] theater:flex-col theater:gap-[26px]">
            <Details workout={workout} level={level} pills={pills} totalSeconds={totalSeconds} exerciseCount={exerciseCount} doneAt={doneAt} />
            <div className="mt-1.5">{begin}</div>
          </div>
        </div>

        {/* Solid, so it covers the pinned cover as it scrolls up. The photo's
            fade into the page rides on top of it (the same stops the cover
            had: clear at 28% of its height, 0.25 at 60%, solid at the
            bottom), so at rest it looks as before and, scrolling, the title
            keeps its soft fade rather than meeting a hard edge. */}
        <div
          className="relative z-10 -mt-12 flex flex-col gap-6 px-5 theater:ml-[50%] theater:mt-0 theater:min-h-dvh theater:px-20 theater:pb-16 theater:pt-[88px]"
          style={{ background: "linear-gradient(180deg, rgba(12,16,20,0.73) 0px, #0C1014 48px)" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-[190px] h-[190px] theater:hidden"
            style={{
              background: "linear-gradient(180deg, rgba(12,16,20,0) 0%, rgba(12,16,20,0.25) 56%, rgba(12,16,20,0.73) 100%)",
            }}
          />
          <div className="flex flex-col gap-6 theater:hidden">
            <Details workout={workout} level={level} pills={pills} totalSeconds={totalSeconds} exerciseCount={exerciseCount} doneAt={doneAt} />
          </div>
          <section className="flex flex-col gap-2.5 theater:gap-3.5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/60">The workout</h2>
            {/* With saved progress, what's done is checked off. */}
            <WorkoutRows
              workout={workout}
              steps={steps}
              position={
                resume ? { step: resume.step, complete: false, warmup: resume.warmedUp ? "done" : "skipped" } : null
              }
              warmupOff={!warmup}
              violet
            />
          </section>
        </div>
      </div>

      {/* Begin, pinned to the bottom on phones: a frosted pane in the page's
          colour (like the site's phone header), with a hairline edge, so the
          list visibly slides under it. Its background also carries on below
          it, solid, behind a floating Safari toolbar, so nothing scrolls into
          view underneath. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.08] bg-[#0C1014]/75 backdrop-blur-xl backdrop-saturate-150 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-40 after:bg-[#0C1014] theater:hidden">
        <div className="mx-auto max-w-[560px] px-5 pb-[max(20px,calc(env(safe-area-inset-bottom)+8px))] pt-4">{begin}</div>
      </div>
    </div>
  );
}

/** Title, description, the three stats and "You'll need". */
function Details({
  workout,
  level,
  pills,
  totalSeconds,
  exerciseCount,
  doneAt,
}: {
  workout: PlayerWorkout;
  level: string | null;
  pills: ReturnType<typeof equipmentPills>;
  totalSeconds: number;
  exerciseCount: number;
  doneAt: string | null;
}) {
  return (
    <>
      <div className="flex flex-col gap-2.5 theater:gap-3">
        {(!workout.published || doneAt) && (
          <div className="flex flex-wrap gap-2">
            {!workout.published && (
              <span className="flex h-[26px] items-center rounded-full bg-amber-300/20 px-2.5 text-xs font-semibold text-amber-200">
                Draft · only admins can see this
              </span>
            )}
            {/* Finished before: when, like the workout cards. */}
            {doneAt && (
              <span className="flex h-[26px] items-center gap-1 rounded-full bg-emerald-400/15 pl-2 pr-2.5 text-xs font-semibold text-emerald-300">
                <Check size={14} />
                <DoneLabel at={doneAt} />
              </span>
            )}
          </div>
        )}
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.015em] theater:text-[56px] theater:leading-[1.02] theater:tracking-[-0.02em]">
          {workout.title}
        </h1>
        {workout.description && (
          <p className="text-base leading-[1.45] text-white/75 theater:text-lg theater:text-white/80">{workout.description}</p>
        )}
      </div>

      <div
        className={`grid gap-2 rounded-[18px] border border-white/[0.06] bg-white/[0.06] px-2 py-3.5 theater:flex theater:gap-10 theater:border-0 theater:bg-transparent theater:p-0 ${
          level ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <Stat value={`${aboutMinutes(totalSeconds)} min`} label="Workout" />
        <Stat value={String(exerciseCount)} label={exerciseCount === 1 ? "Exercise" : "Exercises"} />
        {level && <Stat value={level} label="Level" />}
      </div>

      {pills.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/60">You&rsquo;ll need</h2>
          <div className="flex flex-wrap gap-2">
            {pills.map((p) => {
              const Icon = EQUIPMENT_ICONS[p.icon];
              return (
                <span
                  key={p.key}
                  className="flex h-9 items-center gap-2 rounded-full bg-white/[0.08] pl-3 pr-3.5 text-sm font-medium theater:h-[38px] theater:bg-white/[0.12] theater:pl-[13px] theater:pr-4 theater:text-[15px]"
                >
                  {/* A lighter violet than the button's: thin lines on the dark page. */}
                  <span className="flex text-violet-400">
                    <Icon />
                  </span>
                  {p.label}
                </span>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center theater:items-start theater:text-left">
      <span className="text-[22px] font-semibold theater:text-[26px]">{value}</span>
      <span className="text-[13px] text-white/65 theater:text-sm">{label}</span>
    </div>
  );
}

/**
 * Begin workout, with a Warm-up switch beside it (on by default) when the
 * workout has one. Side by side on phones and on desktop. With saved
 * progress it's Resume (and how far along) beside Start over instead.
 */
function BeginRow({
  workout,
  canStart,
  warmup,
  onWarmup,
  onBegin,
  resume,
  onResume,
}: {
  workout: PlayerWorkout;
  canStart: boolean;
  warmup: boolean;
  onWarmup: (on: boolean) => void;
  onBegin: (withWarmup: boolean) => void;
  resume: { percent: number } | null;
  onResume: () => void;
}) {
  if (!canStart) {
    return <p className="py-4 text-center text-white/70 theater:text-left">This workout doesn&rsquo;t have any exercises yet.</p>;
  }
  if (resume) {
    return (
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onResume}
          className="flex h-[58px] min-w-0 flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-violet-500 px-4 text-white theater:max-w-[320px]"
        >
          <span className="flex flex-col items-center leading-tight">
            <span className="text-[17px] font-semibold">Resume</span>
            <span className="text-[13px] font-medium text-white/75">{resume.percent}% complete</span>
          </span>
          <ArrowRight />
        </button>
        {/* A fresh start, with the warm-up if the member's setting says so. */}
        <button
          type="button"
          onClick={() => onBegin(!!workout.warmup && warmup)}
          className="flex h-[58px] shrink-0 items-center gap-2 px-1 text-[15px] font-semibold text-white/85"
        >
          <RestartWorkout size={18} />
          Start over
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onBegin(!!workout.warmup && warmup)}
        className="flex h-[58px] min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-violet-500 px-4 text-[17px] font-semibold text-white theater:max-w-[320px]"
      >
        Begin workout
        <ArrowRight />
      </button>
      {workout.warmup && (
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold" aria-hidden="true">
            Warm-up
          </span>
          <Switch on={warmup} onChange={onWarmup} label="Warm-up" onClass="bg-violet-500" />
        </div>
      )}
    </div>
  );
}
