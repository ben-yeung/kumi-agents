import { describe, expect, it } from "vitest";
import { LANES } from "@/lib/lanes";
import { createRng } from "@/lib/rng";
import { LIVE_NOTES, WORKLOG, nextLogEntry, type LogEntry } from "@/lib/worklog";

describe("nextLogEntry", () => {
  it("moves time forward, changes hands, and never repeats a line", () => {
    const rng = createRng(3);
    const log: LogEntry[] = [...WORKLOG];
    for (let i = 0; i < LIVE_NOTES.length; i++) {
      const prev = log[log.length - 1];
      const next = nextLogEntry(rng, log)!;
      expect(next.agent).not.toBe(prev.agent);
      expect(next.time > prev.time).toBe(true);
      expect(log.map((e) => e.text)).not.toContain(next.text);
      expect(log.map((e) => e.id)).not.toContain(next.id);
      log.push(next);
    }
  });

  it("tells the rest of the afternoon in order, ending with the release", () => {
    const rng = createRng(3);
    const log: LogEntry[] = [...WORKLOG];
    for (const note of LIVE_NOTES) {
      const next = nextLogEntry(rng, log)!;
      expect(next.text).toBe(note.text);
      log.push(next);
    }
    expect(nextLogEntry(rng, log)).toBeNull();
    expect(log[log.length - 1].agent).toBe("tao");
  });

  it("closes out every agent's lane", () => {
    expect(LIVE_NOTES.map((n) => n.agent)).toEqual(LANES.map((l) => l.agent));
  });
});
