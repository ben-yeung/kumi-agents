import { describe, expect, it } from "vitest";
import { AGENTS } from "@/lib/agents";

describe("agents", () => {
  it("each has a short, personal status of their own", () => {
    const lines = AGENTS.flatMap((a) => [a.greeting, a.noteReaction]);
    expect(new Set(lines).size).toBe(lines.length);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(16);
  });
});
