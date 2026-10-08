"use client";

import { groupLabels, setStepFor, WARMUP_CUE, type WorkoutStep } from "@move-mindful/core";
import { amountLabel, clock, type PlayerWorkout } from "@/lib/workouts/player";
import { ACCENT } from "./progress-bar";
import { Check, Loop, Moon, Sun, Timer } from "./icons";

type Status = "todo" | "now" | "done";

/**
 * Where the member is, for the overview; null on the preview screen, where
 * every row is upcoming and nothing is tappable.
 */
export interface RowsPosition {
  step: number;
  complete: boolean;
  /** How the warm-up went: played, skipped, or playing now. */
  warmup: "done" | "skipped" | "now";
  /** The cool-down, after the exercises: playing now, or not yet (the default). */
  cooldown?: "todo" | "now";
}

/**
 * The workout as a list: the warm-up, single exercises, rests and supersets /
 * circuits, and the cool-down. Every row leads with one status circle — an empty ring before it
 * starts, solid accent while it's on, white with a check once done. Before the
 * workout starts (the preview, the overview: no `position`) the warm-up block
 * is one row; under way, it's listed like a circuit.
 */
export function WorkoutRows({
  workout,
  steps,
  position,
  onJump,
  warmupOff = false,
  spotlight,
}: {
  workout: PlayerWorkout;
  steps: WorkoutStep[];
  position: RowsPosition | null;
  onJump?: (step: number) => void;
  /** On the preview: the member has switched the warm-up off. */
  warmupOff?: boolean;
  /**
   * The workout overview (after the intro): nothing's done or under way yet;
   * instead the exercise on screen is lit — every row of it. With `onPick`
   * (the builder, recording its tip) tapping an exercise picks it, with the
   * tap's time (the event's timeStamp); members just watch. Lit rows carry
   * `data-spotlit`.
   */
  spotlight?: { exerciseId: string | null; onPick?: (exerciseId: string, at: number) => void };
}) {
  const labels = groupLabels(workout.blocks);
  // During the warm-up no exercise is on yet: only its row is current.
  const cur = position && !position.complete && position.warmup !== "now" ? position.step : null;
  const curStep = cur !== null ? steps[cur] : null;
  // The set on screen, or — during a rest — the one coming up.
  const curSetIndex = cur !== null ? setStepFor(steps, cur) : null;
  const curSet = curSetIndex !== null ? steps[curSetIndex] : null;

  const lit = (exerciseId: string) => spotlight?.exerciseId === exerciseId;
  const blockStatus = (block: number): Status => {
    if (spotlight) {
      const b = workout.blocks[block];
      const on =
        b.kind === "exercise"
          ? lit(b.move.exerciseId)
          : b.kind === "group" && (b.warmup ? lit(WARMUP_CUE) : b.moves.some((m) => lit(m.exerciseId)));
      return on ? "now" : "todo";
    }
    if (position?.complete) return "done";
    if (cur === null) return "todo";
    if (curStep?.block === block) return "now";
    const last = steps.findLastIndex((s) => s.block === block);
    return last !== -1 && last < cur ? "done" : "todo";
  };
  const stepOf = (block: number, round: number, move: number) =>
    steps.findIndex((s) => s.kind === "set" && s.block === block && s.round === round && s.move === move && s.part === 0);
  // Rests with nothing to rest before (at the very start or end) don't play,
  // so they aren't listed either — see workoutSteps.
  const firstWork = workout.blocks.findIndex((b) => b.kind !== "rest");
  const lastWork = workout.blocks.findLastIndex((b) => b.kind !== "rest");
  const partStatus = (index: number): Status =>
    position?.complete || (cur !== null && index < cur) ? "done" : index === cur ? "now" : "todo";

  return (
    <div role="list" className="flex flex-col gap-1.5">
      {workout.warmup && (
        <div role="listitem">
          {position ? (
            <div className="flex items-center gap-3 px-2.5 py-2">
              <Circle status={position.warmup === "skipped" ? "todo" : position.warmup} icon="sun" />
              <RowText
                name="Warm-up"
                detail={position.warmup === "skipped" ? "Skipped" : clock(workout.warmup.clip.durationSeconds ?? 0)}
                dim={position.warmup !== "now"}
              />
            </div>
          ) : (
            <div
              className={`flex items-center gap-3 rounded-[14px] border border-dashed border-white/[0.22] bg-white/5 px-3 py-2.5 transition-opacity duration-200 ${
                warmupOff ? "opacity-40" : ""
              }`}
            >
              <Circle status="todo" icon="sun" />
              <RowText
                name="Warm-up"
                detail={`${clock(workout.warmup.clip.durationSeconds ?? 0)} · ${workout.warmup.name}`}
              />
              {/* Follows the Warm-up switch beside Begin workout. */}
              {warmupOff ? (
                <span className="flex h-[22px] shrink-0 items-center rounded-full bg-white/[0.12] px-2 text-[11px] font-bold uppercase tracking-[0.06em]">
                  Skipped
                </span>
              ) : (
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#34D399] text-[#14142B]">
                  <Check size={13} width={3} />
                  <span className="sr-only">Included</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {workout.blocks.map((b, i) => {
        if (b.kind === "rest") {
          if (i < firstWork || i > lastWork) return null;
          return (
            <div key={i} role="listitem" className="flex items-center gap-2 px-3.5 text-[13px] text-white/60">
              <Timer />
              {clock(b.seconds)} rest
            </div>
          );
        }

        const status = blockStatus(i);
        if (b.kind === "exercise") {
          const ex = workout.exercises[b.move.exerciseId];
          const amount = amountLabel(b.move.measure, b.move.amount, ex?.sided);
          const first = stepOf(i, 1, 0);
          const tappable = spotlight ? !!spotlight.onPick : !!onJump && status !== "now" && first !== -1;
          const pick = (e: React.MouseEvent) =>
            spotlight ? spotlight.onPick?.(b.move.exerciseId, e.timeStamp) : onJump!(first);
          const setsPips = Array.from({ length: b.sets }, (_, s) =>
            steps.map((st, k) => ({ st, k })).filter(({ st }) => st.kind === "set" && st.block === i && st.round === s + 1),
          );
          const Tag = tappable ? "button" : "div";
          return (
            <div key={i} role="listitem">
              <Tag
                {...(tappable
                  ? { type: "button" as const, onClick: pick, "aria-label": `${spotlight ? "Show" : "Jump to"} ${ex?.name}` }
                  : {})}
                data-spotlit={(spotlight && status === "now") || undefined}
                className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] px-2.5 py-2 text-left ${
                  status === "now" ? "border-[#A99CFF]/60 bg-[#A99CFF]/[0.14]" : "border-transparent"
                }`}
              >
                <Circle status={status} />
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className={`text-base font-semibold ${status === "done" ? "text-white/60" : ""}`}>{ex?.name}</span>
                  <span className="text-[13px] text-white/70">{b.sets > 1 ? `${b.sets} sets × ${amount}` : amount}</span>
                  {status === "now" && curSet?.kind === "set" && b.sets > 1 && (
                    <span className="text-[13px] font-semibold text-[#A99CFF]">
                      Now · Set {curSet.round} of {b.sets}
                    </span>
                  )}
                </span>
                {position && b.sets > 1 && (
                  <span className="flex shrink-0 gap-[5px]">
                    {setsPips.map((parts, s) => (
                      <span key={s} className="flex gap-[1.5px]">
                        {parts.map(({ k }, j) => (
                          <Pip key={k} status={partStatus(k)} radius={parts.length === 1 ? "4px" : j === 0 ? "4px 1px 1px 4px" : "1px 4px 4px 1px"} />
                        ))}
                      </span>
                    ))}
                  </span>
                )}
              </Tag>
            </div>
          );
        }

        // The warm-up, before the workout starts: one row — tapped as a whole while recording the overview's tip.
        if (b.warmup && !position) {
          const seconds = steps.reduce((sum, st) => (st.block === i ? sum + st.seconds : sum), 0);
          const count = b.moves.length;
          const detail = [`${count} ${count === 1 ? "exercise" : "exercises"}`, b.rounds > 1 && `${b.rounds} rounds`, clock(seconds)]
            .filter(Boolean)
            .join(" · ");
          const onPick = spotlight?.onPick;
          const Tag = onPick ? "button" : "div";
          return (
            <div key={i} role="listitem">
              <Tag
                {...(onPick
                  ? {
                      type: "button" as const,
                      onClick: (e: React.MouseEvent) => onPick(WARMUP_CUE, e.timeStamp),
                      "aria-label": "Show the warm-up",
                    }
                  : {})}
                data-spotlit={(spotlight && status === "now") || undefined}
                className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] px-2.5 py-2 text-left ${
                  status === "now" ? "border-[#A99CFF]/60 bg-[#A99CFF]/[0.14]" : "border-transparent"
                }`}
              >
                <Circle status={status} icon="sun" />
                <RowText name="Warm-up" detail={detail} />
              </Tag>
            </div>
          );
        }

        // Superset or circuit (or the warm-up, under way).
        const round = status === "now" && curSet?.kind === "set" && curSet.block === i ? curSet.round : null;
        return (
          <div
            key={i}
            role="listitem"
            className={`flex flex-col gap-1 rounded-2xl border p-2.5 ${
              status === "now" ? "border-[#A99CFF]/35 bg-white/5" : "border-white/[0.12] bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3 px-0.5 pb-1.5 pt-0.5">
              <Circle status={status} icon={b.warmup ? "sun" : "loop"} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={`text-base font-bold ${status === "done" ? "text-white/60" : ""}`}>{labels[i]}</span>
                <span className="text-[13px] text-white/70">
                  {b.rounds} {b.rounds === 1 ? "round" : "rounds"}
                  {b.restBetweenExercises > 0 && ` · ${clock(b.restBetweenExercises)} rest between`}
                </span>
              </span>
              {position && (
                <span className="flex shrink-0 flex-col items-end gap-[5px]">
                  <span className="flex gap-1">
                    {Array.from({ length: b.rounds }, (_, r) => (
                      <Pip
                        key={r}
                        radius="4px"
                        status={status === "done" ? "done" : round === null ? "todo" : r + 1 < round ? "done" : r + 1 === round ? "now" : "todo"}
                      />
                    ))}
                  </span>
                  {(status === "done" || round !== null) && (
                    <span className={`text-xs font-semibold ${round !== null ? "text-[#A99CFF]" : "text-white/60"}`}>
                      {round !== null ? `Round ${round} of ${b.rounds}` : "Done"}
                    </span>
                  )}
                </span>
              )}
            </div>
            {b.moves.map((m, k) => {
              const ex = workout.exercises[m.exerciseId];
              const now = spotlight ? lit(m.exerciseId) : round !== null && curSet?.kind === "set" && curSet.move === k;
              const target = stepOf(i, round ?? 1, k);
              const tappable = spotlight ? !!spotlight.onPick : !!onJump && !now && target !== -1;
              const pick = (e: React.MouseEvent) =>
                spotlight ? spotlight.onPick?.(m.exerciseId, e.timeStamp) : onJump!(target);
              const Tag = tappable ? "button" : "div";
              return (
                <Tag
                  key={k}
                  {...(tappable
                    ? { type: "button" as const, onClick: pick, "aria-label": `${spotlight ? "Show" : "Jump to"} ${ex?.name}` }
                    : {})}
                  data-spotlit={(spotlight && now) || undefined}
                  className={`flex w-full items-center gap-3 rounded-xl border-[1.5px] px-2 py-1.5 text-left ${
                    now ? "border-[#A99CFF]/60 bg-[#A99CFF]/[0.14]" : "border-transparent"
                  }`}
                >
                  <span className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-white/[0.12] text-[13px] font-bold">
                    {String.fromCharCode(65 + k)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className={`text-[15px] font-semibold ${status === "done" ? "text-white/60" : ""}`}>{ex?.name}</span>
                    <span className="text-[13px] text-white/70">{amountLabel(m.measure, m.amount, ex?.sided)}</span>
                  </span>
                  {now && !spotlight && <span className="shrink-0 text-xs font-bold text-[#A99CFF]">Now</span>}
                </Tag>
              );
            })}
          </div>
        );
      })}

      {workout.cooldown && (
        <div role="listitem">
          {position ? (
            <div className="flex items-center gap-3 px-2.5 py-2">
              <Circle status={position.cooldown === "now" ? "now" : "todo"} icon="moon" />
              <RowText
                name="Cool-down"
                detail={clock(workout.cooldown.clip.durationSeconds ?? 0)}
                dim={position.cooldown !== "now"}
              />
            </div>
          ) : (
            // Offered after the last exercise ("Cool down?"), so there's no switch for it here.
            <div className="flex items-center gap-3 rounded-[14px] border border-dashed border-white/[0.22] bg-white/5 px-3 py-2.5">
              <Circle status="todo" icon="moon" />
              <RowText
                name="Cool-down"
                detail={`${clock(workout.cooldown.clip.durationSeconds ?? 0)} · ${workout.cooldown.name}`}
              />
              <span className="flex h-[22px] shrink-0 items-center rounded-full bg-white/[0.12] px-2 text-[11px] font-bold uppercase tracking-[0.06em]">
                Optional
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RowText({ name, detail, dim = false }: { name: string; detail: string; dim?: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-px">
      <span className={`text-base font-semibold ${dim ? "text-white/60" : ""}`}>{name}</span>
      <span className="text-[13px] text-white/70">{detail}</span>
    </span>
  );
}

function Pip({ status, radius }: { status: Status; radius: string }) {
  const bg = status === "done" ? "#ffffff" : status === "now" ? ACCENT : "rgba(255,255,255,0.24)";
  return <span className="size-2" style={{ background: bg, borderRadius: radius }} />;
}

/** The status circle every row leads with. */
function Circle({ status, icon }: { status: Status; icon?: "loop" | "sun" | "moon" }) {
  const Icon = icon === "loop" ? Loop : icon === "sun" ? Sun : icon === "moon" ? Moon : null;
  if (status === "done") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#14142B]">
        <Check />
      </span>
    );
  }
  if (status === "now") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#A99CFF] text-[#14142B]">
        {Icon ? <Icon /> : <span className="size-2.5 rounded-full bg-[#14142B]" />}
      </span>
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/30 text-white/80">
      {Icon && <Icon />}
    </span>
  );
}
