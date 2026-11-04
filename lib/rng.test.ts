import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";

describe("createRng", () => {
  it("is deterministic for a seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, a.next)).toEqual(Array.from({ length: 5 }, b.next));
  });

  it("differs across seeds", () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it("keeps int() within inclusive bounds", () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const n = rng.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it("shuffle keeps every item exactly once", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(createRng(9).shuffle(items).sort()).toEqual(items);
  });
});
