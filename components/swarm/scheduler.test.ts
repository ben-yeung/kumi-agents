import { describe, expect, it } from "vitest";
import {
  LIVE_ORDER,
  backlog,
  isReady,
  missingOwners,
  pickTask,
  sectionBuilding,
  sectionDone,
  type SchedulerState,
} from "./scheduler";
import type { Task, TaskStatus } from "./types";

function task(id: string, extra: Partial<Task> = {}): Task {
  return { id, kind: "type", section: "s", order: 0, after: [], parent: null, label: id, ...extra };
}

function state(tasks: Task[], status: Record<string, TaskStatus> = {}, extra = {}): SchedulerState {
  return {
    tasks,
    status: new Map(Object.entries(status)),
    activeSections: new Set(["s"]),
    crew: ["ren", "sol"],
    ...extra,
  };
}

describe("scheduler", () => {
  it("waits for inactive sections", () => {
    const s = state([task("a", { section: "later" })]);
    expect(pickTask("ren", s)).toBeNull();
  });

  it("waits on parents and explicit dependencies", () => {
    const tasks = [task("p"), task("c", { parent: "p" }), task("d", { after: ["p"] })];
    expect(isReady(tasks[1], state(tasks))).toBe(false);
    expect(isReady(tasks[2], state(tasks, { p: "claimed" }))).toBe(false);
    expect(isReady(tasks[1], state(tasks, { p: "done" }))).toBe(true);
    expect(isReady(tasks[2], state(tasks, { p: "done" }))).toBe(true);
  });

  it("ignores dependencies on tasks that do not exist", () => {
    expect(isReady(task("a", { after: ["ghost"] }), state([task("a", { after: ["ghost"] })]))).toBe(
      true,
    );
  });

  it("respects hard assignments while that agent is on the crew", () => {
    const s = state([task("a", { agent: "sol" })]);
    expect(pickTask("ren", s)).toBeNull();
    expect(pickTask("sol", s)?.id).toBe("a");
    const gone = state([task("a", { agent: "tao" })]);
    expect(pickTask("ren", gone)?.id).toBe("a");
  });

  it("never gives signed work to anyone but its owner", () => {
    const t = task("a", { owner: "mika" });
    expect(pickTask("ren", state([t]))).toBeNull();
    expect(pickTask("ren", state([t], {}, { crew: ["ren", "mika"] }))).toBeNull();
    expect(pickTask("mika", state([t], {}, { crew: ["ren", "mika"] }))?.id).toBe("a");
  });

  it("names the owners who need calling in, soonest first", () => {
    const tasks = [
      task("late", { owner: "tao", order: 5 }),
      task("soon", { owner: "mika", order: 1 }),
      task("again", { owner: "mika", order: 2 }),
      task("here", { owner: "ren", order: 0 }),
      task("taken", { owner: "bea", order: 0 }),
      task("waiting", { owner: "oki", after: ["late"] }),
    ];
    expect(missingOwners(state(tasks, { taken: "claimed" }))).toEqual(["mika", "tao"]);
  });

  it("knows when a section is still being built, ignoring later live work", () => {
    const tasks = [task("a"), task("later", { section: "other" })];
    expect(sectionBuilding(state(tasks))).toBe(true);
    expect(sectionBuilding(state(tasks, { a: "claimed" }))).toBe(true);
    expect(sectionBuilding(state(tasks, { a: "done" }))).toBe(false);
    const live = [task("a"), task("note", { order: LIVE_ORDER })];
    expect(sectionBuilding(state(live, { a: "done" }))).toBe(false);
  });

  it("takes the lowest order, then the nearest", () => {
    const tasks = [
      task("far", { order: 1 }),
      task("near", { order: 1 }),
      task("late", { order: 2 }),
    ];
    const dist = (t: Task) => (t.id === "near" ? 10 : 100);
    expect(pickTask("ren", state(tasks), dist)?.id).toBe("near");
    expect(pickTask("ren", state([tasks[2], tasks[0]]), dist)?.id).toBe("far");
  });

  it("puts work the visitor is looking at first", () => {
    const tasks = [task("above", { order: 1 }), task("here", { section: "seen", order: 2 })];
    const active = new Set(["s", "seen"]);
    const s = state(tasks, {}, { activeSections: active, focus: new Set(["seen"]) });
    expect(pickTask("ren", s)?.id).toBe("here");
    expect(pickTask("ren", state([tasks[0]], {}, { focus: new Set(["seen"]) }))?.id).toBe("above");
  });

  it("skips claimed and done work", () => {
    const tasks = [task("a"), task("b"), task("c")];
    const s = state(tasks, { a: "done", b: "claimed" });
    expect(pickTask("ren", s)?.id).toBe("c");
    expect(backlog(s)).toBe(1);
    expect(sectionDone("s", s)).toBe(false);
    expect(sectionDone("s", state(tasks, { a: "done", b: "done", c: "done" }))).toBe(true);
  });
});
