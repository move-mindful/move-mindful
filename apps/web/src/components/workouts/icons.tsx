// Icons for the member workout screens, drawn to match the player design canvas.

import type { ReactNode } from "react";

function Stroke({ size = 22, width = 2, children }: { size?: number; width?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const ChevronLeft = ({ size }: P) => <Stroke size={size} width={2.2}><path d="m15 18-6-6 6-6" /></Stroke>;
export const ChevronRight = ({ size }: P) => <Stroke size={size} width={2.2}><path d="m9 18 6-6-6-6" /></Stroke>;
export const ChevronUp = ({ size = 20 }: P) => <Stroke size={size} width={2.4}><path d="m6 15 6-6 6 6" /></Stroke>;
export const ChevronDown = ({ size = 20 }: P) => <Stroke size={size} width={2.4}><path d="m6 9 6 6 6-6" /></Stroke>;
export const ArrowRight = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Stroke>
);
export const ArrowUp = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </Stroke>
);
export const ArrowDown = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Stroke>
);
export const Close = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.4}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Stroke>
);
export const Check = ({ size = 16, width = 2.8 }: P & { width?: number }) => (
  <Stroke size={size} width={width}><path d="M20 6 9 17l-5-5" /></Stroke>
);

export const Star = ({ size = 36, filled = false }: P & { filled?: boolean }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92z" />
  </svg>
);

export const Pause = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
    <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
    <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
  </svg>
);
export const Play = ({ size = 40 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const Sound = ({ size }: P) => (
  <Stroke size={size}>
    <path d="M11 4.7 6.3 8.5H3.5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.8l4.7 3.8a.6.6 0 0 0 1-.5V5.2a.6.6 0 0 0-1-.5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Stroke>
);
/** Music (two notes): the Audio card's Music. */
export const Music = ({ size }: P) => (
  <Stroke size={size}>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Stroke>
);
export const Muted = ({ size }: P) => (
  <Stroke size={size}>
    <path d="M11 4.7 6.3 8.5H3.5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2.8l4.7 3.8a.6.6 0 0 0 1-.5V5.2a.6.6 0 0 0-1-.5z" />
    <path d="m22 9-6 6" />
    <path d="m16 9 6 6" />
  </Stroke>
);

/** The player's settings (a gear): tutorials, for now. */
export const Settings = ({ size }: P) => (
  <Stroke size={size}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
);
export const WatchTutorial = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="shrink-0">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const RestartSet = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Stroke>
);
export const RestartWorkout = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M19 20 9 12l10-8z" />
    <path d="M5 19V5" />
  </Stroke>
);
export const Exit = ({ size = 20 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Stroke>
);

/** The workout overview (desktop). */
export const List = ({ size }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="M4.5 6h.01" />
    <path d="M4.5 12h.01" />
    <path d="M4.5 18h.01" />
  </Stroke>
);

/** Supersets and circuits. */
export const Loop = ({ size = 15 }: P) => (
  <Stroke size={size} width={2.4}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </Stroke>
);
/** The warm-up. */
export const Sun = ({ size = 16 }: P) => (
  <Stroke size={size}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </Stroke>
);
/** The cool-down: the warm-up's sun, set. */
export const Moon = ({ size = 16 }: P) => (
  <Stroke size={size}>
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
  </Stroke>
);
/** A rest. */
export const Timer = ({ size = 14 }: P) => (
  <Stroke size={size}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9.5V13l2.5 1.5" />
    <path d="M9.5 2.5h5" />
  </Stroke>
);

export const Dumbbell = ({ size = 17 }: P) => (
  <Stroke size={size} width={2.2}>
    <path d="M6.5 6.5v11" />
    <path d="M17.5 6.5v11" />
    <path d="M3.5 9v6" />
    <path d="M20.5 9v6" />
    <path d="M6.5 12h11" />
  </Stroke>
);
export const Mat = ({ size = 17 }: P) => (
  <Stroke size={size}>
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 8v8" />
  </Stroke>
);
export const Band = ({ size = 17 }: P) => (
  <Stroke size={size}>
    <path d="M4 12c0-3 3.6-5 8-5s8 2 8 5-3.6 5-8 5-8-2-8-5z" />
    <path d="M8 12h8" />
  </Stroke>
);
export const Chair = ({ size = 17 }: P) => (
  <Stroke size={size}>
    <path d="M7 3v9h10V3" />
    <path d="M6 12h12" />
    <path d="M7 12v9" />
    <path d="M17 12v9" />
  </Stroke>
);

export const EQUIPMENT_ICONS = { dumbbell: Dumbbell, mat: Mat, band: Band, chair: Chair } as const;
