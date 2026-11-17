import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useTaskSheetWidthStore } from "./task-sheet-width-store";
import { TaskSheetResizeHandle } from "./task-sheet-resize-handle";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

function getHandle() {
  return screen.getByRole("separator", { name: "tasks:detail.resizePane" });
}

beforeEach(() => {
  setViewportWidth(1600);
});

afterEach(() => {
  cleanup();
  useTaskSheetWidthStore.getState().resetWidth();
});

describe("TaskSheetResizeHandle", () => {
  it("announces the current width and its limits", () => {
    render(<TaskSheetResizeHandle />);

    const handle = getHandle();
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "1075");
    expect(handle).toHaveAttribute("aria-valuemin", "384");
    expect(handle).toHaveAttribute("aria-valuemax", "1552");
  });

  it("widens the pane when dragged towards the left", () => {
    render(<TaskSheetResizeHandle />);
    const handle = getHandle();

    fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 300, pointerId: 1 });

    expect(useTaskSheetWidthStore.getState().width).toBeCloseTo(1275.2);
  });

  it("stops at the limits while dragging", () => {
    render(<TaskSheetResizeHandle />);
    const handle = getHandle();

    fireEvent.pointerDown(handle, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 1500, pointerId: 1 });

    expect(useTaskSheetWidthStore.getState().width).toBe(384);
  });

  it("steps the width with the arrow keys", () => {
    useTaskSheetWidthStore.getState().setWidth(800);
    render(<TaskSheetResizeHandle />);
    const handle = getHandle();

    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(useTaskSheetWidthStore.getState().width).toBe(832);

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(useTaskSheetWidthStore.getState().width).toBe(768);
  });

  it("goes back to the default width on double-click", () => {
    useTaskSheetWidthStore.getState().setWidth(800);
    render(<TaskSheetResizeHandle />);

    fireEvent.doubleClick(getHandle());

    expect(useTaskSheetWidthStore.getState().width).toBeNull();
    expect(getHandle()).toHaveAttribute("aria-valuenow", "1075");
  });

  it("clamps the width again when the window shrinks", () => {
    useTaskSheetWidthStore.getState().setWidth(1400);
    render(<TaskSheetResizeHandle />);

    act(() => {
      setViewportWidth(1000);
      window.dispatchEvent(new Event("resize"));
    });

    expect(useTaskSheetWidthStore.getState().width).toBe(952);
    expect(getHandle()).toHaveAttribute("aria-valuemax", "952");
  });
});
