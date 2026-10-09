/**
 * What shows the moment a workout is tapped, while its preview renders: the
 * preview's shape in its own dark colours, so the screen goes dark right away
 * instead of the list sitting there. See (app)/loading.tsx for why it matters.
 */
export default function Loading() {
  return (
    <div className="min-h-dvh animate-pulse bg-[#0C1014]" role="status" aria-label="Loading">
      <div className="mx-auto max-w-[560px] theater:max-w-none">
        <div className="h-[330px] bg-white/[0.06] theater:fixed theater:inset-y-0 theater:left-0 theater:h-auto theater:w-1/2" />
        <div className="-mt-12 flex flex-col gap-3 px-5 theater:ml-[50%] theater:mt-0 theater:px-20 theater:pt-[88px]">
          <div className="h-9 w-2/3 rounded-lg bg-white/[0.1]" />
          <div className="h-4 w-full rounded bg-white/[0.07]" />
          <div className="h-4 w-4/5 rounded bg-white/[0.07]" />
          <div className="mt-3 h-[72px] rounded-[18px] bg-white/[0.07]" />
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
