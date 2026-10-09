"use client";

import { useSyncExternalStore } from "react";

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * This week, Monday to Sunday, with today in bold — the top of /workouts.
 *
 * A placeholder for now: nothing is tracked yet. Each date sits in a circle-
 * sized slot so a done check can take its place later without the row moving.
 *
 * The dates come from the device's clock, so "today" is the member's today
 * (the server's could be a day off). Until the page is up in the browser the
 * labels show and the dates are held blank, so nothing shifts when they fill
 * in. It also rolls over at midnight if the page is left open.
 */
export function WeekStrip() {
  const today = useSyncExternalStore(subscribeMidnight, todayKey, () => null);
  const days = today ? weekOf(today) : null;

  return (
    <div className="grid grid-cols-7 text-center md:max-w-md">
      {LABELS.map((label, i) => {
        const day = days?.[i];
        const on = !!day?.isToday;
        const tone = on
          ? "font-semibold text-zinc-900 dark:text-white"
          : "text-zinc-500";
        return (
          <div key={label} aria-current={on ? "date" : undefined} className="flex flex-col items-center gap-1">
            <span className={`text-[15px] ${tone}`}>{label}</span>
            <span className={`flex size-8 items-center justify-center text-[15px] tabular-nums ${tone} ${on ? "font-bold" : ""}`}>
              {day?.date}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Today as "year-month-day" in the device's timezone — a stable snapshot. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Monday to Sunday of the week holding `key`'s day. */
function weekOf(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const today = new Date(y, m, d);
  const monday = new Date(y, m, d - ((today.getDay() + 6) % 7));
  return LABELS.map((_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { date: day.getDate(), isToday: day.getTime() === today.getTime() };
  });
}

/** Re-checks the date just after each midnight. */
function subscribeMidnight(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(() => {
      onChange();
      schedule();
    }, next.getTime() - now.getTime() + 1000);
  };
  schedule();
  return () => clearTimeout(timer);
}
