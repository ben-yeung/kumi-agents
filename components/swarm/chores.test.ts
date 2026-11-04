import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { AGENTS } from "@/lib/agents";
import { CHORES, PLANS, RECHECK_MS, freshWork, pickChore, pickPlan } from "./chores";

const every = [
  ...Object.values(CHORES)
    .flat()
    .map((c) => c.label),
  ...PLANS,
];

describe("chores", () => {
  it("gives every agent their own work to do, in active words", () => {
    expect(new Set(every).size).toBe(every.length);
    for (const label of every) expect(label).not.toMatch(/rest|paus|wait|leav|stretch|tidy/);
    for (const a of AGENTS) expect(CHORES[a.id].length).toBeGreaterThan(1);
  });

  it("leaves reviewing to the reviewer", () => {
    const reviewing = Object.entries(CHORES).filter(([, list]) =>
      list.some((c) => /review|proof/.test(c.label)),
    );
    expect(reviewing.map(([id]) => id)).toEqual(["mika"]);
  });

  it("never does the same chore twice running, when there is another", () => {
    const rng = createRng(4);
    let last: string | null = null;
    for (let i = 0; i < 30; i++) {
      const chore = pickChore(rng, "sol", "type", last);
      expect(chore?.label).not.toBe(last);
      last = chore!.label;
    }
  });

  it("only offers chores that suit the work", () => {
    expect(pickChore(createRng(1), "sol", "box", null)).toBeNull();
    expect(pickChore(createRng(1), "sol", "type", null)?.tool).toBe("ibeam");
  });

  it("does not plan the same thing twice running", () => {
    const rng = createRng(2);
    let last: string | null = null;
    for (let i = 0; i < 30; i++) {
      const plan = pickPlan(rng, last);
      expect(plan).not.toBe(last);
      last = plan;
    }
  });

  it("leaves work alone once anyone has been over it", () => {
    const a = { el: "a" };
    const b = { el: "b" };
    const checked = new Map([["a", 1000]]);
    expect(freshWork([a, b], checked, 2000)).toEqual([b]);
    expect(freshWork([a, b], checked, 1000 + RECHECK_MS)).toEqual([a, b]);
  });
});
