import type { RatingSummary } from "@/lib/workouts/shared";

// Member ratings, as the admin sees them: on the workouts list and in the
// builder. No hooks, so it works in server and client components alike.

function StarIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92z" />
    </svg>
  );
}

const average = (r: RatingSummary) => r.average.toFixed(1);

/** "★ 4.6 (12)" for a row; "No ratings" before any. */
export function RatingBadge({ rating }: { rating: RatingSummary | null }) {
  if (!rating) return <span className="text-sm text-zinc-400">No ratings</span>;
  return (
    <span
      className="flex items-center gap-1 text-sm"
      title={`${average(rating)} out of 5 from ${rating.count} ${rating.count === 1 ? "rating" : "ratings"}`}
    >
      <span className="text-amber-500">
        <StarIcon filled />
      </span>
      <span className="font-semibold tabular-nums">{average(rating)}</span>
      <span className="text-zinc-500 tabular-nums">({rating.count})</span>
    </span>
  );
}

/** The builder's card: the average, five stars, the count, and how many gave each. */
export function RatingDetails({ rating }: { rating: RatingSummary | null }) {
  if (!rating) {
    return <p className="text-sm text-zinc-500">No ratings yet. Members rate a workout when they finish it.</p>;
  }
  const rounded = Math.round(rating.average);
  const most = Math.max(...rating.byStars, 1);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <p className="text-4xl font-semibold tracking-tight tabular-nums">{average(rating)}</p>
        <div className="pb-1">
          <div className="flex text-amber-500" aria-label={`${average(rating)} out of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <StarIcon key={n} filled={n <= rounded} size={16} />
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            {rating.count} {rating.count === 1 ? "rating" : "ratings"}
          </p>
        </div>
      </div>
      <dl className="space-y-1">
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n} className="flex items-center gap-2 text-sm">
            <dt className="w-3 text-right tabular-nums text-zinc-600">{n}</dt>
            <dd className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${(rating.byStars[n - 1] / most) * 100}%` }} />
            </dd>
            <dd className="w-6 text-right tabular-nums text-zinc-500">{rating.byStars[n - 1]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
