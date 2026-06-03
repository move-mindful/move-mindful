import type { ReactNode } from "react";

const theaterMaxWidth = "calc((100svh - 6rem) * 16 / 9)";

export function VideoTheaterStage({ children }: { children: ReactNode }) {
  return (
    <section className="-mt-px w-full bg-black pt-px">
      <div className="mx-auto w-full" style={{ maxWidth: theaterMaxWidth }}>
        {children}
      </div>
    </section>
  );
}
