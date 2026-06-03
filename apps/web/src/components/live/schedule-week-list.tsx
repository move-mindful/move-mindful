"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DateTime } from "luxon";
import { ARIZONA_ZONE, LIVE_SCHEDULE, classColor } from "@/lib/live-schedule";

// Simple "is client" hook that avoids the setState-in-effect lint error.
const emptySubscribe = () => () => {};
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface WeekClass {
  title: string;
  time: string;
  duration: number;
  sortKey: number;
}

/**
 * Compact weekly schedule list for mobile. Shows each day of the current week
 * that has scheduled classes, with class name, local time, and duration. Days
 * without classes are omitted to keep it tight.
 */
export function ScheduleWeekList() {
  const mounted = useIsMounted();

  const days = useMemo(() => {
    if (!mounted) return [];

    const localZone = DateTime.local().zoneName;
    const now = DateTime.now().setZone(localZone);
    // Start of this ISO week (Monday)
    const weekStart = now.startOf("week");

    // Build an array of 7 days (Mon–Sun), each with its classes
    const result: { label: string; isToday: boolean; classes: WeekClass[] }[] =
      [];

    for (let d = 0; d < 7; d++) {
      const day = weekStart.plus({ days: d });
      const dayClasses: WeekClass[] = [];

      for (const s of LIVE_SCHEDULE) {
        // Build occurrence in Arizona time, then convert to local
        const azTime = day.setZone(ARIZONA_ZONE).set({
          hour: s.hour,
          minute: s.minute,
          second: 0,
          millisecond: 0,
        });
        // Adjust to the correct weekday within the same week
        const occAz = azTime.set({
          weekday: s.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        });
        // Only include if this occurrence's local date matches this day
        const local = occAz.setZone(localZone);
        if (local.hasSame(day, "day")) {
          dayClasses.push({
            title: s.title,
            time: local.toFormat("h:mm a"),
            duration: s.duration,
            sortKey: local.hour * 60 + local.minute,
          });
        }
      }

      dayClasses.sort((a, b) => a.sortKey - b.sortKey);

      if (dayClasses.length > 0) {
        result.push({
          label: DAY_LABELS[d],
          isToday: day.hasSame(now, "day"),
          classes: dayClasses,
        });
      }
    }

    return result;
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="h-48 animate-pulse rounded-xl bg-zinc-50" />
      </div>
    );
  }

  const localZoneLabel = DateTime.local().toFormat("ZZZZ");

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">This week</h2>
      </div>

      <div className="divide-y divide-zinc-100">
        {days.map((day) => (
          <div key={day.label} className="px-4 py-3">
            <h3
              className={`text-sm font-semibold ${
                day.isToday ? "text-zinc-900" : "text-zinc-500"
              }`}
            >
              {day.label}
              {day.isToday && (
                <span className="ml-2 inline-block rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                  Today
                </span>
              )}
            </h3>
            <div className="mt-2 space-y-1.5">
              {day.classes.map((c, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    classColor[c.title] ?? "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  <span className="text-sm font-medium">{c.time}</span>
                  <span className="text-sm">{c.title}</span>
                  <span className="ml-auto text-xs opacity-70">
                    {c.duration} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-400">
        Times in your local timezone ({localZoneLabel}). Same classes every week.
      </p>
    </div>
  );
}
