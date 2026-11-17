import type { CSSProperties } from "react";

const MIN_WIDTH_REM = 24;
// The sheet already leaves this gap beside the window edge.
const WINDOW_GAP_REM = 3;

// Tailwind sm/md/lg breakpoints paired with the default pane width, in rem.
const DEFAULT_WIDTHS_REM: ReadonlyArray<
  [minViewportRem: number, widthRem: number]
> = [
  [64, 67.2],
  [48, 50.4],
  [0, 38.4],
];

// Must match WINDOW_GAP_REM and DEFAULT_WIDTHS_REM above (Tailwind needs the
// literal class names). A chosen width is passed in --task-sheet-width; without
// it, each breakpoint falls back to its default.
export const TASK_SHEET_WIDTH_CLASS =
  "sm:w-[calc(100%-3rem)] sm:max-w-[var(--task-sheet-width,38.4rem)] md:max-w-[var(--task-sheet-width,50.4rem)] lg:max-w-[var(--task-sheet-width,67.2rem)]";

export function getTaskSheetWidthStyle(width: number | null) {
  if (width === null) return undefined;
  return { "--task-sheet-width": `${width}px` } as CSSProperties;
}

export function getTaskSheetWidthBounds(viewportWidth: number, remPx: number) {
  const min = MIN_WIDTH_REM * remPx;
  const max = Math.max(min, viewportWidth - WINDOW_GAP_REM * remPx);
  return { min, max };
}

export function clampTaskSheetWidth(
  width: number,
  viewportWidth: number,
  remPx: number,
) {
  const { min, max } = getTaskSheetWidthBounds(viewportWidth, remPx);
  return Math.min(max, Math.max(min, width));
}

export function getDefaultTaskSheetWidth(viewportWidth: number, remPx: number) {
  const viewportRem = viewportWidth / remPx;
  // The last entry starts at 0, so find() always matches.
  const [, widthRem] = DEFAULT_WIDTHS_REM.find(
    ([minRem]) => viewportRem >= minRem,
  )!;
  return Math.min(
    widthRem * remPx,
    getTaskSheetWidthBounds(viewportWidth, remPx).max,
  );
}
