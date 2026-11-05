import { describe, expect, it } from "vitest";
import {
  INITIAL_WORK,
  LANES,
  cards,
  column,
  finishStep,
  hasWork,
  isFinished,
  nextToWrite,
  openPiece,
  pickLane,
  planCardVisit,
  planVisit,
  setProgress,
  settleOpening,
  settleVisit,
  startCard,
  writeStep,
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

  it("carries every piece to exactly 100%, adds the next, then stops", () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = createRng(seed);
      let work: Work = INITIAL_WORK;
      for (const { agent } of LANES) {
        for (let i = 0; i < 300; i++) {
          const lane = work.lanes.find((l) => l.agent === agent)!;
          if (!hasWork(lane)) break;
          // A visitor can flip views at any time, so the two kinds of visit mix.
          const visit = i % 3 === 0 ? planCardVisit(lane) : planVisit(lane, rng);
          if (!visit) {
            expect(lane.progress).toBe(1);
            work = settleOpening(work, agent);
            continue;
          }
          expect(visit.to).toBeGreaterThan(visit.from);
          work = settleVisit(work, visit);
        }
        const lane = work.lanes.find((l) => l.agent === agent)!;
        expect(isFinished(lane)).toBe(true);
        expect(lane.progress).toBe(1);
        expect(planVisit(lane, rng)).toBeNull();
      }
      expect(column(work, "done")).toHaveLength(72);
      expect(work.lanes.some(hasWork)).toBe(false);
    }
  });

  it("gives each card its own progress, not its lane's", () => {
    const cardOf = (agent: string) => column(INITIAL_WORK, "doing").find((c) => c.agent === agent)!;
    expect(cardOf("juno").progress).toBeCloseTo(0.64);
    expect(cardOf("oki").progress).toBeCloseTo(0.2);
  });

  it("always takes a board card to 100% and finishes it", () => {
    let work: Work = INITIAL_WORK;
    for (const [i, id] of ["oki-0-1", "oki-0-2"].entries()) {
      const lane = work.lanes.find((l) => l.agent === "oki")!;
      const visit = planCardVisit(lane)!;
      expect(visit.tick).toBe(i + 1);
      const drawn = setProgress(work, "oki", visit.to);
      const held = column(drawn, "doing").find((c) => c.id === id)!;
      expect(held.progress).toBe(1);
      work = settleVisit(drawn, visit);
      expect(column(work, "done")[0].id).toBe(id);
      const next = column(work, "doing").find((c) => c.agent === "oki");
      expect(next?.progress ?? 0).toBe(0);
    }
    const lane = work.lanes.find((l) => l.agent === "oki")!;
    expect(lane.progress).toBe(1);
    expect(planCardVisit(lane)).toBeNull();
  });

  it("puts a finished card at the top of Completed", () => {
    const work = finishStep(INITIAL_WORK, "sol", 1);
    expect(column(work, "done")[0].id).toBe("sol-0-1");
    expect(column(work, "doing").find((c) => c.agent === "sol")?.id).toBe("sol-0-2");
  });

  it("keeps the next card in Planned until it is dragged across", () => {
    const held = finishStep(INITIAL_WORK, "sol", 1, true);
    expect(column(held, "planned").map((c) => c.id)).toContain("sol-0-2");
    expect(column(held, "doing").some((c) => c.agent === "sol")).toBe(false);
    const started = startCard(held, "sol-0-2");
    expect(column(started, "doing")[0].id).toBe("sol-0-2");
  });

  it("settles an interrupted visit to the same place as a finished one", () => {
    const visit = { agent: "sol", from: 0.41, to: 0.7, tick: 1 } as const;
    const halfway = setProgress(finishStep(INITIAL_WORK, "sol", 1, true), "sol", 0.5);
    const settled = settleVisit(halfway, visit);
    expect(settled).toEqual(settleVisit(INITIAL_WORK, visit));
    expect(settled.recent).toEqual(["sol-0-1"]);
  });

  describe("adding a piece", () => {
    const finished = settleVisit(INITIAL_WORK, planCardVisit(LANES[0])!);

    it("keeps the finished cards and starts the new piece at nothing", () => {
      const work = settleOpening(finished, "juno");
      const lane = work.lanes.find((l) => l.agent === "juno")!;
      expect(lane.piece).toBe(LANES[0].backlog[0].piece);
      expect(lane.progress).toBe(0);
      expect(lane.backlog).toHaveLength(1);
      expect(lane.past.map((p) => p.piece)).toEqual([LANES[0].piece]);
      expect(cards(work)).toHaveLength(27);
      expect(column(work, "done").filter((c) => c.agent === "juno")).toHaveLength(3);
      expect(column(work, "doing").find((c) => c.agent === "juno")?.id).toBe("juno-1-0");
    });

    it("writes cards one at a time, in order, holding the first in Planned", () => {
      let work = openPiece(finished, "juno");
      expect(cards(work)).toHaveLength(24);
      const written = () =>
        column(work, "planned")
          .filter((c) => c.agent === "juno")
          .map((c) => c.id);
      for (let i = 0; i < 3; i++) {
        const lane = work.lanes.find((l) => l.agent === "juno")!;
        expect(nextToWrite(lane)).toBe(`juno-1-${i}`);
        work = writeStep(work, "juno");
      }
      expect(written()).toEqual(["juno-1-0", "juno-1-1", "juno-1-2"]);
      const lane = work.lanes.find((l) => l.agent === "juno")!;
      expect(nextToWrite(lane)).toBeNull();
      expect(writeStep(work, "juno")).toEqual(work);
    });

    it("only adds to a finished lane with something left in its backlog", () => {
      expect(openPiece(INITIAL_WORK, "juno")).toBe(INITIAL_WORK);
      let work = finished;
      for (let piece = 0; piece < LANES[0].backlog.length; piece++) {
        work = settleOpening(work, "juno");
        for (const step of [0, 1, 2]) {
          const lane = work.lanes.find((l) => l.agent === "juno")!;
          expect(planCardVisit(lane)?.tick).toBe(step);
          work = settleVisit(work, planCardVisit(lane)!);
        }
      }
      expect(hasWork(work.lanes.find((l) => l.agent === "juno")!)).toBe(false);
      expect(openPiece(work, "juno")).toBe(work);
    });

    it("settles an interrupted addition to the same place as an untouched one", () => {
      const halfway = writeStep(openPiece(finished, "juno"), "juno");
      const lanes = (w: Work) => w.lanes;
      expect(lanes(settleOpening(halfway, "juno"))).toEqual(lanes(settleOpening(finished, "juno")));
      expect(settleOpening(halfway, "juno").waiting).toEqual([]);
    });

    it("keeps every piece three steps long so notes hold their height", () => {
      for (const lane of LANES) {
        expect(lane.backlog).toHaveLength(2);
        for (const piece of lane.backlog) expect(piece.steps).toHaveLength(3);
      }
    });

    it("gives every card a unique id", () => {
      let work = finished;
      for (let piece = 0; piece < LANES[0].backlog.length; piece++) {
        work = settleOpening(work, "juno");
        for (let step = 0; step < 3; step++)
          work = settleVisit(work, planCardVisit(work.lanes[0])!);
      }
      const ids = cards(work).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it("visits whoever has waited longest, skipping the unseen and the finished", () => {
    const done = { ...ren, backlog: [], steps: ren.steps.map((s) => ({ ...s, done: true })) };
    const seen = new Map([["sol", 5]] as const);
    expect(pickLane([ren, sol], ["ren", "sol"], seen)?.agent).toBe("ren");
    expect(pickLane([done, sol], ["ren", "sol"], seen)?.agent).toBe("sol");
    expect(pickLane([ren, sol], ["sol"], seen)?.agent).toBe("sol");
    expect(pickLane([done], ["ren"], seen)).toBeNull();
  });
});
