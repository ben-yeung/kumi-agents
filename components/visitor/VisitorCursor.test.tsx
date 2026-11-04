import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TAG_MODE_KEY, VISITOR_SEED_KEY } from "@/components/prefs/keys";
import { writeStored } from "@/components/prefs/storage";
import { VisitorCursor } from "@/components/visitor/VisitorCursor";

function mockMatchMedia(matches: Record<string, boolean>) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches[query] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function move(target: Element) {
  const e = new MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 50 });
  Object.defineProperty(e, "pointerType", { value: "mouse" });
  act(() => {
    target.dispatchEvent(e);
  });
}

describe("VisitorCursor", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(VISITOR_SEED_KEY, "42");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-visitor-cursor");
  });

  it("renders nothing on coarse pointers", () => {
    mockMatchMedia({ "(pointer: fine)": false });
    const { container } = render(<VisitorCursor />);
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement).not.toHaveAttribute("data-visitor-cursor");
  });

  it("tags the visitor as you, with the hovered element's intent", async () => {
    mockMatchMedia({ "(pointer: fine)": true });
    render(
      <>
        <h1 data-intent="reading the headline">Hello</h1>
        <VisitorCursor />
      </>,
    );

    expect(document.documentElement).toHaveAttribute("data-visitor-cursor", "on");
    expect(screen.getByText("you")).toBeInTheDocument();

    move(screen.getByText("Hello"));
    // The action types itself into the tag.
    expect(
      await screen.findByText("reading the headline", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("hides actions in names-only mode", () => {
    mockMatchMedia({ "(pointer: fine)": true });
    render(
      <>
        <h1 data-intent="reading the headline">Hello</h1>
        <VisitorCursor />
      </>,
    );
    act(() => writeStored(TAG_MODE_KEY, "names"));
    move(screen.getByText("Hello"));
    expect(screen.queryByText("reading the headline")).not.toBeInTheDocument();
  });
});
