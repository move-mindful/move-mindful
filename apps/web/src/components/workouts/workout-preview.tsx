"use client";

import Image from "next/image";
import Link from "next/link";
import { aboutMinutes, type WorkoutStep } from "@move-mindful/core";
import {
  clock,
  equipmentPills,
  levelLabel,
  type PlayerWorkout,
} from "@/lib/workouts/player";
import { ArrowRight, ChevronLeft, EQUIPMENT_ICONS } from "./icons";
import { WorkoutRows } from "./workout-rows";

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
  onBegin,
}: {
  workout: PlayerWorkout;
  steps: WorkoutStep[];
  totalSeconds: number;
  exerciseCount: number;
  backHref: string;
  onBegin: (withWarmup: boolean) => void;
}) {
  const level = levelLabel(workout.level);
  const pills = equipmentPills(workout);
  const firstSet = steps.find((s) => s.kind === "set");
  const firstExercise = firstSet?.kind === "set" ? workout.exercises[firstSet.exerciseId] : undefined;
  const cover =
    workout.coverImageUrl ??
    (firstExercise?.loops.main ?? firstExercise?.loops.right ?? firstExercise?.loops.left)?.poster ??
    null;
  const canStart = steps.length > 0;

  const begin = (
    <BeginButtons workout={workout} canStart={canStart} onBegin={onBegin} />
  );

  return (
    <div className="min-h-dvh bg-[#14142B] text-white">
      <div className="mx-auto max-w-[560px] pb-44 theater:max-w-none theater:pb-0">
        {/* The cover — on desktop, the whole left half, with the details over it. */}
        <div className="relative h-[330px] overflow-hidden theater:fixed theater:inset-y-0 theater:left-0 theater:h-auto theater:w-1/2">
          {cover && (
            <Image
              src={cover}
              alt=""
              fill
              unoptimized
              priority
              className="object-cover"
              style={{ objectPosition: "50% 28%" }}
            />
          )}
          <div
            className="absolute inset-0 theater:hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(20,20,43,0.4) 0%, rgba(20,20,43,0) 28%, rgba(20,20,43,0.25) 60%, #14142B 100%)",
            }}
          />
          <div
            className="absolute inset-0 hidden theater:block"
            style={{
              background:
                "linear-gradient(180deg, rgba(20,20,43,0.45) 0%, rgba(20,20,43,0) 16%, rgba(20,20,43,0.2) 34%, rgba(20,20,43,0.86) 56%, #14142B 72%), linear-gradient(90deg, rgba(20,20,43,0) 72%, #14142B 100%)",
            }}
          />
          <Link
            href={backHref}
            aria-label="Back"
            className="absolute left-4 top-5 flex size-11 items-center justify-center rounded-full bg-[#0E0E20]/50 backdrop-blur-md theater:left-12 theater:top-8 theater:w-auto theater:gap-1 theater:pl-3 theater:pr-[18px]"
          >
            <ChevronLeft />
            <span className="hidden text-[15px] font-semibold theater:inline">Back</span>
          </Link>

          <div className="hidden theater:absolute theater:bottom-[72px] theater:left-20 theater:right-16 theater:flex theater:max-w-[576px] theater:flex-col theater:gap-[26px]">
            <Details workout={workout} level={level} pills={pills} totalSeconds={totalSeconds} exerciseCount={exerciseCount} />
            <div className="mt-1.5">{begin}</div>
          </div>
        </div>

        <div className="relative -mt-12 flex flex-col gap-6 px-5 theater:ml-[50%] theater:mt-0 theater:min-h-dvh theater:px-20 theater:pb-16 theater:pt-[88px]">
          <div className="flex flex-col gap-6 theater:hidden">
            <Details workout={workout} level={level} pills={pills} totalSeconds={totalSeconds} exerciseCount={exerciseCount} />
          </div>
          <section className="flex flex-col gap-2.5 theater:gap-3.5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/65">The workout</h2>
            <WorkoutRows workout={workout} steps={steps} position={null} />
          </section>
        </div>
      </div>

      {/* Begin, pinned to the bottom on phones. */}
      <div className="fixed inset-x-0 bottom-0 theater:hidden">
        <div
          className="mx-auto max-w-[560px] px-5 pb-[max(28px,calc(env(safe-area-inset-bottom)+12px))] pt-9"
          style={{ background: "linear-gradient(0deg, #14142B 74%, rgba(20,20,43,0) 100%)" }}
        >
          {begin}
        </div>
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
}: {
  workout: PlayerWorkout;
  level: string | null;
  pills: ReturnType<typeof equipmentPills>;
  totalSeconds: number;
  exerciseCount: number;
}) {
  return (
    <>
      <div className="flex flex-col gap-2.5 theater:gap-3">
        {!workout.published && (
          <span className="flex h-[26px] items-center self-start rounded-full bg-amber-300/20 px-2.5 text-xs font-semibold text-amber-200">
            Draft · only admins can see this
          </span>
        )}
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.015em] theater:text-[56px] theater:leading-[1.02] theater:tracking-[-0.02em]">
          {workout.title}
        </h1>
        {workout.description && (
          <p className="text-base leading-[1.45] text-white/75 theater:text-lg theater:text-white/80">{workout.description}</p>
        )}
      </div>

      <div
        className={`grid gap-2 rounded-[18px] bg-white/[0.07] px-2 py-3.5 theater:flex theater:gap-10 theater:bg-transparent theater:p-0 ${
          level ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        <Stat value={`${aboutMinutes(totalSeconds)} min`} label="Workout" />
        <Stat value={String(exerciseCount)} label={exerciseCount === 1 ? "Exercise" : "Exercises"} />
        {level && <Stat value={level} label="Level" />}
      </div>

      {pills.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/65">You&rsquo;ll need</h2>
          <div className="flex flex-wrap gap-2">
            {pills.map((p) => {
              const Icon = EQUIPMENT_ICONS[p.icon];
              return (
                <span
                  key={p.key}
                  className="flex h-9 items-center gap-2 rounded-full bg-white/10 pl-3 pr-3.5 text-sm font-medium theater:h-[38px] theater:bg-white/[0.12] theater:pl-[13px] theater:pr-4 theater:text-[15px]"
                >
                  <Icon />
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
      <span className="text-[13px] text-white/70 theater:text-sm">{label}</span>
    </div>
  );
}

/** "Begin with warm-up" and "Skip warm-up and start" — or just "Begin". Stacked on phones, side by side on desktop. */
function BeginButtons({
  workout,
  canStart,
  onBegin,
}: {
  workout: PlayerWorkout;
  canStart: boolean;
  onBegin: (withWarmup: boolean) => void;
}) {
  const primary =
    "flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B] theater:pl-[30px] theater:pr-[26px]";
  if (!canStart) {
    return <p className="py-4 text-center text-white/70 theater:text-left">This workout doesn&rsquo;t have any exercises yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5 theater:flex-row theater:flex-wrap theater:gap-3">
      {workout.warmup ? (
        <>
          <button type="button" onClick={() => onBegin(true)} className={primary}>
            Begin with warm-up
            <span className="font-medium tabular-nums text-[#5B5B72]">{clock(workout.warmup.clip.durationSeconds ?? 0)}</span>
            <ArrowRight />
          </button>
          <button
            type="button"
            onClick={() => onBegin(false)}
            className="h-[54px] rounded-full bg-white/[0.12] text-base font-semibold theater:h-[58px] theater:bg-white/[0.14] theater:px-[26px]"
          >
            Skip warm-up and start
          </button>
        </>
      ) : (
        <button type="button" onClick={() => onBegin(false)} className={primary}>
          Begin
          <ArrowRight />
        </button>
      )}
    </div>
  );
}
