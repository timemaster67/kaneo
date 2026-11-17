import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  clampTaskSheetWidth,
  getDefaultTaskSheetWidth,
  getTaskSheetWidthBounds,
} from "./task-sheet-width";
import { useTaskSheetWidthStore } from "./task-sheet-width-store";

const KEYBOARD_STEP_PX = 32;

function getRemPx() {
  return (
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  );
}

export function TaskSheetResizeHandle() {
  const { t } = useTranslation();
  const width = useTaskSheetWidthStore((state) => state.width);
  const setWidth = useTaskSheetWidthStore((state) => state.setWidth);
  const resetWidth = useTaskSheetWidthStore((state) => state.resetWidth);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const remPx = getRemPx();
  const { min, max } = getTaskSheetWidthBounds(viewportWidth, remPx);
  const currentWidth = width ?? getDefaultTaskSheetWidth(viewportWidth, remPx);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      const { width: storedWidth } = useTaskSheetWidthStore.getState();
      if (storedWidth === null) return;
      const clamped = clampTaskSheetWidth(
        storedWidth,
        window.innerWidth,
        getRemPx(),
      );
      if (clamped !== storedWidth) setWidth(clamped);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setWidth]);

  const resizeTo = (next: number) =>
    setWidth(clampTaskSheetWidth(next, viewportWidth, remPx));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: currentWidth };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // The pane is anchored to the right edge, so moving left widens it.
    resizeTo(drag.startWidth + drag.startX - event.clientX);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      resizeTo(currentWidth + KEYBOARD_STEP_PX);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      resizeTo(currentWidth - KEYBOARD_STEP_PX);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("tasks:detail.resizePane")}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={resetWidth}
      className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize touch-none outline-none transition-colors hover:bg-primary/30 focus-visible:bg-primary/50 sm:block"
    />
  );
}
