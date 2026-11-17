import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import { GlobalShortcuts } from "./global-shortcuts";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [] }),
}));

afterEach(() => {
  cleanup();
});

describe("GlobalShortcuts", () => {
  it("keeps Ctrl+S from opening the browser's save dialog", () => {
    const { getByRole } = render(
      <ShortcutTestWrapper>
        <GlobalShortcuts />
        <textarea aria-label="draft" />
      </ShortcutTestWrapper>,
    );
    const press = (target: Element) =>
      fireEvent.keyDown(target, { key: "s", code: "KeyS", ctrlKey: true });

    expect(press(document.body)).toBe(false);
    expect(press(getByRole("textbox", { name: "draft" }))).toBe(false);
  });
});
