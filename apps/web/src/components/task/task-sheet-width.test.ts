import { describe, expect, it } from "vite-plus/test";
import {
  clampTaskSheetWidth,
  getDefaultTaskSheetWidth,
  getTaskSheetWidthBounds,
  getTaskSheetWidthStyle,
  TASK_SHEET_WIDTH_CLASS,
} from "./task-sheet-width";

const REM = 16;

describe("getDefaultTaskSheetWidth", () => {
  it("is 20% wider than the old defaults at each breakpoint", () => {
    // Old defaults: sm 32rem, md 42rem, lg 56rem.
    expect(getDefaultTaskSheetWidth(700, REM)).toBeCloseTo(614.4); // 38.4rem
    expect(getDefaultTaskSheetWidth(900, REM)).toBeCloseTo(806.4); // 50.4rem
    expect(getDefaultTaskSheetWidth(1600, REM)).toBeCloseTo(1075.2); // 67.2rem
  });

  it("never exceeds the window width minus the 3rem gap", () => {
    expect(getDefaultTaskSheetWidth(1100, REM)).toBe(1052);
  });
});

describe("getTaskSheetWidthBounds", () => {
  it("allows 24rem up to the window width minus 3rem", () => {
    expect(getTaskSheetWidthBounds(1600, REM)).toEqual({ min: 384, max: 1552 });
  });

  it("keeps max at least min on very narrow windows", () => {
    expect(getTaskSheetWidthBounds(400, REM)).toEqual({ min: 384, max: 384 });
  });
});

describe("clampTaskSheetWidth", () => {
  it("keeps widths inside the bounds", () => {
    expect(clampTaskSheetWidth(100, 1600, REM)).toBe(384);
    expect(clampTaskSheetWidth(900, 1600, REM)).toBe(900);
    expect(clampTaskSheetWidth(2000, 1600, REM)).toBe(1552);
  });

  it("re-clamps a stored width when the window shrinks", () => {
    expect(clampTaskSheetWidth(1400, 1000, REM)).toBe(952);
  });
});

describe("TASK_SHEET_WIDTH_CLASS", () => {
  const toRem = (px: number) => Number((px / REM).toFixed(2));

  it("uses the same default widths as getDefaultTaskSheetWidth", () => {
    for (const [prefix, viewportWidth] of [
      ["sm", 700],
      ["md", 900],
      ["lg", 1600],
    ] as const) {
      const widthRem = toRem(getDefaultTaskSheetWidth(viewportWidth, REM));
      expect(TASK_SHEET_WIDTH_CLASS).toContain(
        `${prefix}:max-w-[var(--task-sheet-width,${widthRem}rem)]`,
      );
    }
  });

  it("leaves the same window gap as getTaskSheetWidthBounds", () => {
    const gapRem = toRem(1600 - getTaskSheetWidthBounds(1600, REM).max);
    expect(TASK_SHEET_WIDTH_CLASS).toContain(`sm:w-[calc(100%-${gapRem}rem)]`);
  });
});

describe("getTaskSheetWidthStyle", () => {
  it("sets the width variable only for a chosen width", () => {
    expect(getTaskSheetWidthStyle(null)).toBeUndefined();
    expect(getTaskSheetWidthStyle(900)).toEqual({
      "--task-sheet-width": "900px",
    });
  });
});
