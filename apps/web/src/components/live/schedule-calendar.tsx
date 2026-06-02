"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ARIZONA_ZONE, LIVE_SCHEDULE, classColor } from "@/lib/live-schedule";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DayClass {
  title: string;
  time: string;
  sortKey: number;
}

// Build a map of local day-of-month → classes occurring that day, with their
// times converted into the viewer's local timezone. Because a class defined in
// Arizona time can fall on a different calendar day for far-away timezones, we
// bucket by the *local* day each occurrence actually lands on.
function buildOccurrences(year: number, month0: number): Map<number, DayClass[]> {
  const localZone = DateTime.local().zoneName;
  const monthStart = DateTime.fromObject(
    { year, month: month0 + 1, day: 1 },
    { zone: localZone },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month");

  // Pad the search window by a day on each side (in Arizona time) so occurrences
  // that cross a date boundary into this month are still caught.
  const windowStart = monthStart.minus({ days: 1 }).setZone(ARIZONA_ZONE);
  const windowEnd = monthEnd.plus({ days: 1 }).setZone(ARIZONA_ZONE);

  const map = new Map<number, DayClass[]>();

  for (const s of LIVE_SCHEDULE) {
    let occ = windowStart.set({
      weekday: s.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      hour: s.hour,
      minute: s.minute,
      second: 0,
      millisecond: 0,
    });
    if (occ < windowStart) occ = occ.plus({ weeks: 1 });

    while (occ <= windowEnd) {
      const local = occ.setZone(localZone);
      if (local.year === year && local.month === month0 + 1) {
        const list = map.get(local.day) ?? [];
        list.push({
          title: s.title,
          time: local.toFormat("h:mm a"),
          sortKey: local.hour * 60 + local.minute,
        });
        map.set(local.day, list);
      }
      occ = occ.plus({ weeks: 1 });
    }
  }

  for (const list of map.values()) list.sort((a, b) => a.sortKey - b.sortKey);
  return map;
}

export function ScheduleCalendar() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState({ year: 2000, month: 0 });

  // Timezone + "current month" are only known in the browser, so resolve them
  // after mount to avoid a server/client hydration mismatch.
  useEffect(() => {
    const now = new Date();
    setView({ year: now.getFullYear(), month: now.getMonth() });
    setMounted(true);
  }, []);

  const occurrences = useMemo(
    () =>
      mounted
        ? buildOccurrences(view.year, view.month)
        : new Map<number, DayClass[]>(),
    [mounted, view.year, view.month],
  );

  if (!mounted) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="h-[28rem] animate-pulse rounded-xl bg-zinc-50" />
      </div>
    );
  }

  const firstDay = new Date(view.year, view.month, 1);
  const leadingBlanks = firstDay.getDay(); // 0 = Sun
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    setView((v) => {
      const next = new Date(v.year, v.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const today = new Date();
  const isCurrentMonth =
    view.year === today.getFullYear() && view.month === today.getMonth();
  const localZoneLabel = DateTime.local().toFormat("ZZZZ"); // e.g. "EDT"

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {MONTH_LABELS[view.month]} {view.year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400"
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label[0]}</span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div
                key={`blank-${i}`}
                className="min-h-20 border-b border-r border-zinc-100 bg-zinc-50/40 last:border-r-0 sm:min-h-28"
              />
            );
          }

          const entries = occurrences.get(day) ?? [];
          const isToday = isCurrentMonth && day === today.getDate();

          return (
            <div
              key={day}
              className="min-h-20 border-b border-r border-zinc-100 p-1.5 last:border-r-0 sm:min-h-28 sm:p-2"
            >
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? "bg-zinc-900 text-white" : "text-zinc-500"
                }`}
              >
                {day}
              </div>
              <div className="space-y-1">
                {entries.map((e, idx) => (
                  <div
                    key={idx}
                    className={`rounded px-1 py-0.5 text-[10px] leading-tight sm:text-xs ${
                      classColor[e.title] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                    title={`${e.title} · ${e.time}`}
                  >
                    <span className="block font-medium">{e.time}</span>
                    <span className="block truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-400">
        Times shown in your local timezone ({localZoneLabel}). Same classes repeat
        every week.
      </p>
    </div>
  );
}
