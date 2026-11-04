import { describe, expect, it } from "vitest";
import { backlog, isReady, pickTask, sectionDone, type SchedulerState } from "./scheduler";
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

  it("respects preferences only while that agent is on the crew", () => {
    const t = task("a", { prefer: "mika" });
    expect(pickTask("ren", state([t]))?.id).toBe("a");
    expect(pickTask("ren", state([t], {}, { crew: ["ren", "mika"] }))).toBeNull();
    expect(pickTask("mika", state([t], {}, { crew: ["ren", "mika"] }))?.id).toBe("a");
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

  it("skips claimed and done work", () => {
    const tasks = [task("a"), task("b"), task("c")];
    const s = state(tasks, { a: "done", b: "claimed" });
    expect(pickTask("ren", s)?.id).toBe("c");
    expect(backlog(s)).toBe(1);
    expect(sectionDone("s", s)).toBe(false);
    expect(sectionDone("s", state(tasks, { a: "done", b: "done", c: "done" }))).toBe(true);
  });
});
