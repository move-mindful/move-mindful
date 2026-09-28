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
 * whole sequence, with Begin pinned to the bottom while the rest scrolls.
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

  return (
    <div className="min-h-dvh bg-[#14142B] text-white">
      <div className="mx-auto max-w-[560px] pb-44">
        <div className="relative h-[330px] overflow-hidden">
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
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(20,20,43,0.4) 0%, rgba(20,20,43,0) 28%, rgba(20,20,43,0.25) 60%, #14142B 100%)",
            }}
          />
          <Link
            href={backHref}
            aria-label="Back"
            className="absolute left-4 top-5 flex size-11 items-center justify-center rounded-full bg-[#0E0E20]/50 backdrop-blur-md"
          >
            <ChevronLeft />
          </Link>
        </div>

        <div className="relative -mt-12 flex flex-col gap-6 px-5">
          <div className="flex flex-col gap-2.5">
            {!workout.published && (
              <span className="flex h-[26px] items-center self-start rounded-full bg-amber-300/20 px-2.5 text-xs font-semibold text-amber-200">
                Draft · only admins can see this
              </span>
            )}
            <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.015em]">{workout.title}</h1>
            {workout.description && <p className="text-base leading-[1.45] text-white/75">{workout.description}</p>}
          </div>

          <div className={`grid gap-2 rounded-[18px] bg-white/[0.07] px-2 py-3.5 ${level ? "grid-cols-3" : "grid-cols-2"}`}>
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
                    <span key={p.key} className="flex h-9 items-center gap-2 rounded-full bg-white/10 pl-3 pr-3.5 text-sm font-medium">
                      <Icon />
                      {p.label}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/65">The workout</h2>
            <WorkoutRows workout={workout} steps={steps} position={null} />
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0">
        <div
          className="mx-auto flex max-w-[560px] flex-col gap-2.5 px-5 pb-[max(28px,calc(env(safe-area-inset-bottom)+12px))] pt-9"
          style={{ background: "linear-gradient(0deg, #14142B 74%, rgba(20,20,43,0) 100%)" }}
        >
          {!canStart ? (
            <p className="py-4 text-center text-white/70">This workout doesn&rsquo;t have any exercises yet.</p>
          ) : workout.warmup ? (
            <>
              <button
                type="button"
                onClick={() => onBegin(true)}
                className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
              >
                Begin with warm-up
                <span className="font-medium tabular-nums text-[#5B5B72]">
                  {clock(workout.warmup.clip.durationSeconds ?? 0)}
                </span>
                <ArrowRight />
              </button>
              <button
                type="button"
                onClick={() => onBegin(false)}
                className="h-[54px] rounded-full bg-white/[0.12] text-base font-semibold"
              >
                Skip warm-up and start
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onBegin(false)}
              className="flex h-[58px] items-center justify-center gap-2.5 rounded-full bg-white text-[17px] font-semibold text-[#14142B]"
            >
              Begin
              <ArrowRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-[22px] font-semibold">{value}</span>
      <span className="text-[13px] text-white/70">{label}</span>
    </div>
  );
}
