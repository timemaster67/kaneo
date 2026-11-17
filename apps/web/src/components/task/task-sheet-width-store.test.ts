import { afterEach, describe, expect, it } from "vite-plus/test";
import { useTaskSheetWidthStore } from "./task-sheet-width-store";

afterEach(() => {
  useTaskSheetWidthStore.getState().resetWidth();
});

describe("useTaskSheetWidthStore", () => {
  it("starts on the default width", () => {
    expect(useTaskSheetWidthStore.getState().width).toBeNull();
  });

  it("keeps a chosen width until it is reset", () => {
    useTaskSheetWidthStore.getState().setWidth(900);
    expect(useTaskSheetWidthStore.getState().width).toBe(900);

    useTaskSheetWidthStore.getState().resetWidth();
    expect(useTaskSheetWidthStore.getState().width).toBeNull();
  });

  it("does not write the width to browser storage", () => {
    useTaskSheetWidthStore.getState().setWidth(900);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
