import { create } from "zustand";

// In memory on purpose: the width follows the user across tasks, projects
// and views, but a reload or a new window starts from the default again.
type TaskSheetWidthStore = {
  /** Pane width in px; null means the responsive default. */
  width: number | null;
  setWidth: (width: number) => void;
  resetWidth: () => void;
};

export const useTaskSheetWidthStore = create<TaskSheetWidthStore>((set) => ({
  width: null,
  setWidth: (width) => set({ width }),
  resetWidth: () => set({ width: null }),
}));
