import { describe, expect, it } from "vitest";
import {
  INITIAL_WORK,
  LANES,
  cards,
  column,
  finishStep,
  isFinished,
  pickLane,
  planVisit,
  setProgress,
  settleVisit,
  startCard,
  type Work,
} from "@/lib/lanes";
import { createRng } from "@/lib/rng";

const ren = LANES.find((l) => l.agent === "ren")!;
const sol = LANES.find((l) => l.agent === "sol")!;

describe("lanes", () => {
  it("runs in workflow order, the earliest pieces furthest along, tao last", () => {
    const progress = LANES.map((l) => l.progress);
    expect(progress).toEqual([...progress].sort((a, b) => b - a));
    expect(new Set(progress).size).toBe(progress.length);
    expect(LANES[LANES.length - 1].agent).toBe("tao");
  });

  it("starts every lane with progress that agrees with its ticks", () => {
    for (const lane of LANES) {
      const done = lane.steps.filter((s) => s.done).length;
      expect(lane.progress).toBeGreaterThanOrEqual(done / lane.steps.length);
      expect(lane.progress).toBeLessThan((done + 1) / lane.steps.length);
    }
  });

  it("shows every step once, with each agent holding one card", () => {
    expect(cards(INITIAL_WORK)).toHaveLength(24);
    expect(column(INITIAL_WORK, "done")).toHaveLength(12);
    expect(column(INITIAL_WORK, "planned")).toHaveLength(4);
    const doing = column(INITIAL_WORK, "doing");
    expect(doing.map((c) => c.agent)).toEqual(LANES.map((l) => l.agent));
  });

  it("carries every lane to exactly 100% with all steps done, then stops", () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = createRng(seed);
      let work: Work = INITIAL_WORK;
      for (const { agent } of LANES) {
        for (let i = 0; i < 100; i++) {
          const lane = work.lanes.find((l) => l.agent === agent)!;
          const visit = planVisit(lane, rng);
          if (!visit) break;
          expect(visit.to).toBeGreaterThan(visit.from);
          work = settleVisit(work, visit);
        }
        const lane = work.lanes.find((l) => l.agent === agent)!;
        expect(isFinished(lane)).toBe(true);
        expect(lane.progress).toBe(1);
        expect(planVisit(lane, rng)).toBeNull();
      }
      expect(column(work, "done")).toHaveLength(24);
    }
  });

  it("puts a finished card at the top of Completed", () => {
    const work = finishStep(INITIAL_WORK, "sol", 1);
    expect(column(work, "done")[0].id).toBe("sol-1");
    expect(column(work, "doing").find((c) => c.agent === "sol")?.id).toBe("sol-2");
  });

  it("keeps the next card in Planned until it is dragged across", () => {
    const held = finishStep(INITIAL_WORK, "sol", 1, true);
    expect(column(held, "planned").map((c) => c.id)).toContain("sol-2");
    expect(column(held, "doing").some((c) => c.agent === "sol")).toBe(false);
    const started = startCard(held, "sol-2");
    expect(column(started, "doing")[0].id).toBe("sol-2");
  });

  it("settles an interrupted visit to the same place as a finished one", () => {
    const visit = { agent: "sol", from: 0.41, to: 0.7, tick: 1 } as const;
    const halfway = setProgress(finishStep(INITIAL_WORK, "sol", 1, true), "sol", 0.5);
    const settled = settleVisit(halfway, visit);
    expect(settled).toEqual(settleVisit(INITIAL_WORK, visit));
    expect(settled.recent).toEqual(["sol-1"]);
  });

  it("visits whoever has waited longest, skipping the unseen and the finished", () => {
    const done = { ...ren, steps: ren.steps.map((s) => ({ ...s, done: true })) };
    const seen = new Map([["sol", 5]] as const);
    expect(pickLane([ren, sol], ["ren", "sol"], seen)?.agent).toBe("ren");
    expect(pickLane([done, sol], ["ren", "sol"], seen)?.agent).toBe("sol");
    expect(pickLane([ren, sol], ["sol"], seen)?.agent).toBe("sol");
    expect(pickLane([done], ["ren"], seen)).toBeNull();
  });
});
