import type { ReactNode } from "react";

const theaterMaxWidth = "calc((100svh - 6rem) * 16 / 9)";

export function VideoTheaterStage({ children }: { children: ReactNode }) {
  return (
    <section
      className="w-full bg-black"
      style={{ boxShadow: "0 -4px 0 0 black" }}
    >
      <div className="mx-auto w-full" style={{ maxWidth: theaterMaxWidth }}>
        {children}
      </div>
    </section>
  );
}
