"use client";

import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { ARIZONA_ZONE, LIVE_SCHEDULE, type ScheduleEntry } from "@/lib/live-schedule";

interface NextClass extends ScheduleEntry {
  time: DateTime;
}

// Find the class that is live right now, or the soonest upcoming one. `now` must
// already be in Arizona time so the schedule's hour/minute line up.
function getCurrentOrNextClass(now: DateTime): NextClass {
  let soonest: NextClass | undefined;

  for (const s of LIVE_SCHEDULE) {
    // Luxon keeps `weekday` within the current Mon–Sun week.
    let classTime = now.set({
      weekday: s.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      hour: s.hour,
      minute: s.minute,
      second: 0,
      millisecond: 0,
    });

    const classEnd = classTime.plus({ minutes: s.duration });

    if (now >= classTime && now < classEnd) {
      return { ...s, time: classTime };
    }

    if (classTime < now) {
      classTime = classTime.plus({ weeks: 1 });
    }

    if (!soonest || classTime < soonest.time) {
      soonest = { ...s, time: classTime };
    }
  }

  // The schedule is never empty, so `soonest` is always assigned here.
  return soonest as NextClass;
}

export type NextClassState =
  | { status: "loading" }
  | { status: "live"; title: string }
  | {
      status: "upcoming";
      title: string;
      dayOfWeek: string;
      timeLocal: string;
      zoneAbbr: string;
      countdown: { days: number; hours: number; minutes: number; seconds: number };
    };

// Tracks the live/next class against the viewer's local clock, ticking once a
// second. Returns plain data so callers can style it however they need.
export function useNextClass(): NextClassState {
  const [state, setState] = useState<NextClassState>({ status: "loading" });

  useEffect(() => {
    function update() {
      const nowAz = DateTime.now().setZone(ARIZONA_ZONE);
      const next = getCurrentOrNextClass(nowAz);
      const classTimeAz = next.time;
      const classEndAz = classTimeAz.plus({ minutes: next.duration });

      if (nowAz >= classTimeAz && nowAz < classEndAz) {
        setState({ status: "live", title: next.title });
        return;
      }

      const localZone = DateTime.local().zoneName;
      const nextLocal = classTimeAz.setZone(localZone);
      const diff = nextLocal
        .diffNow(["days", "hours", "minutes", "seconds"])
        .toObject();

      setState({
        status: "upcoming",
        title: next.title,
        dayOfWeek: nextLocal.toFormat("cccc"),
        timeLocal: nextLocal.toFormat("h:mm a"),
        zoneAbbr: nextLocal.toFormat("ZZZZ"),
        countdown: {
          days: Math.max(0, Math.floor(diff.days ?? 0)),
          hours: Math.max(0, Math.floor(diff.hours ?? 0)),
          minutes: Math.max(0, Math.floor(diff.minutes ?? 0)),
          seconds: Math.max(0, Math.floor(diff.seconds ?? 0)),
        },
      });
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
