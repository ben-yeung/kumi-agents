import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { WORKLOG, nextLogEntry, type LogEntry } from "@/lib/worklog";

describe("nextLogEntry", () => {
  it("moves time forward, changes hands, and never repeats a line", () => {
    const rng = createRng(3);
    const log: LogEntry[] = [...WORKLOG];
    for (let i = 0; i < 12; i++) {
      const prev = log[log.length - 1];
      const next = nextLogEntry(rng, log);
      expect(next.agent).not.toBe(prev.agent);
      expect(next.time > prev.time).toBe(true);
      expect(log.map((e) => e.text)).not.toContain(next.text);
      expect(log.map((e) => e.id)).not.toContain(next.id);
      log.push(next);
    }
  });
});
