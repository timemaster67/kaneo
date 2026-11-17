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
  const [, widthRem] =
    DEFAULT_WIDTHS_REM.find(([minRem]) => viewportRem >= minRem) ??
    DEFAULT_WIDTHS_REM[DEFAULT_WIDTHS_REM.length - 1];
  return Math.min(
    widthRem * remPx,
    getTaskSheetWidthBounds(viewportWidth, remPx).max,
  );
}
