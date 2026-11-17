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
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    width: number | null;
  } | null>(null);

  const [remPx] = useState(getRemPx);
  const { min, max } = getTaskSheetWidthBounds(viewportWidth, remPx);
  const currentWidth =
    width === null
      ? getDefaultTaskSheetWidth(viewportWidth, remPx)
      : clampTaskSheetWidth(width, viewportWidth, remPx);

  useEffect(() => {
    // Also runs on open: the window may have shrunk while the pane was closed.
    const fitToWindow = () => {
      setViewportWidth(window.innerWidth);
      const { width: storedWidth } = useTaskSheetWidthStore.getState();
      if (storedWidth === null) return;
      const clamped = clampTaskSheetWidth(
        storedWidth,
        window.innerWidth,
        remPx,
      );
      if (clamped !== storedWidth) setWidth(clamped);
    };
    fitToWindow();
    window.addEventListener("resize", fitToWindow);
    return () => window.removeEventListener("resize", fitToWindow);
  }, [remPx, setWidth]);

  const resizeTo = (next: number) =>
    setWidth(clampTaskSheetWidth(next, viewportWidth, remPx));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: currentWidth,
      width: null,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    // The pane is anchored to the right edge, so moving left widens it.
    const next = clampTaskSheetWidth(
      drag.startWidth + drag.startX - event.clientX,
      viewportWidth,
      remPx,
    );
    drag.width = next;
    // Resize the pane through the DOM and save to the store on release, so
    // the whole sheet does not re-render on every pointer move.
    const handle = event.currentTarget;
    handle.parentElement?.style.setProperty("--task-sheet-width", `${next}px`);
    handle.setAttribute("aria-valuenow", String(Math.round(next)));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.width !== null) setWidth(drag.width);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      // The pane is anchored to the right edge, so ArrowLeft widens it.
      ArrowLeft: () => resizeTo(currentWidth + KEYBOARD_STEP_PX),
      ArrowRight: () => resizeTo(currentWidth - KEYBOARD_STEP_PX),
      Home: () => setWidth(min),
      End: () => setWidth(max),
      Enter: resetWidth,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
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
      onLostPointerCapture={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={resetWidth}
      className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize touch-none outline-none transition-colors hover:bg-primary/30 focus-visible:bg-primary/50 sm:block"
    />
  );
}
