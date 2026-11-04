import type { AgentId } from "@/lib/agents";

/**
 * How an element gets built:
 * - type: typed character by character, with a caret
 * - box: outline dragged out, then filled
 * - frame: outline dragged out and kept as scaffolding until its children are built
 * - stroke: SVG paths drawn along their length, the cursor riding the tip
 * - develop: quick marquee, then the content develops in like a photo
 * - list: children placed one by one with a tap each
 * - reveal: a tap and a soft fade
 * - pass: no visible work, done immediately
 */
export type BuildKind =
  "type" | "box" | "frame" | "stroke" | "develop" | "list" | "reveal" | "pass";

export const BUILD_KINDS: readonly BuildKind[] = [
  "type",
  "box",
  "frame",
  "stroke",
  "develop",
  "list",
  "reveal",
  "pass",
];

export type Rewrite = {
  /** The word in the final text to stumble on, e.g. "fit". */
  word: string;
  /** What gets typed first, then backspaced, e.g. "cut". */
  wrong: string;
};

export type Task = {
  id: string;
  kind: BuildKind;
  section: string;
  /** Lower runs first among ready tasks. */
  order: number;
  /** Task ids that must be done first. */
  after: string[];
  /** Nearest enclosing build task; it must be done first. */
  parent: string | null;
  /** Hard assignment (choreographed hero work). */
  agent?: AgentId;
  /** Soft preference: only this agent takes it while they are on the crew. */
  prefer?: AgentId;
  label: string;
  /** Seconds to wait after claiming, before starting. */
  delay?: number;
  rewrite?: Rewrite;
  /** Typing pace multiplier (1 = normal). */
  pace?: number;
};

export type TaskStatus = "claimed" | "done";
