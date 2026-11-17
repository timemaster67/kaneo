import { describe, expect, it } from "vite-plus/test";
import {
  clampTaskSheetWidth,
  getDefaultTaskSheetWidth,
  getTaskSheetWidthBounds,
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
