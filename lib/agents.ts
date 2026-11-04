export type AgentId = "ren" | "sol" | "ivo" | "mika" | "juno" | "oki" | "bea" | "tao";

export type Agent = {
  id: AgentId;
  name: string;
  /** CSS custom property holding the agent's pastel, theme-aware. */
  color: string;
  temperament: string;
  /** What the visitor's tag says hovering this agent in the crew row. */
  greeting: string;
  /** What the visitor's tag says reviewing this agent's log note. */
  noteReaction: string;
  /** The work they head off to when they leave the page. */
  objectives: readonly string[];
};

export const AGENTS: readonly Agent[] = [
  {
    id: "ren",
    name: "ren",
    color: "var(--agent-sage)",
    temperament: "lays the first lines",
    greeting: "nodding at ren",
    noteReaction: "querying scope",
    objectives: ["off to sketch search", "off to scope imports"],
  },
  {
    id: "sol",
    name: "sol",
    color: "var(--agent-ochre)",
    temperament: "writes the words",
    greeting: "waving at sol",
    noteReaction: "red-penning sol",
    objectives: ["off to draft the docs", "off to edit release notes"],
  },
  {
    id: "ivo",
    name: "ivo",
    color: "var(--agent-ash)",
    temperament: "measures and aligns",
    greeting: "saluting ivo",
    noteReaction: "auditing ivo",
    objectives: ["off to audit spacing", "off to align the tables"],
  },
  {
    id: "mika",
    name: "mika",
    color: "var(--agent-rose)",
    temperament: "reviews and refines",
    greeting: "smiling at mika",
    noteReaction: "reviewing mika",
    objectives: ["off to review a PR", "off to chase a flaky test"],
  },
  {
    id: "juno",
    name: "juno",
    color: "var(--agent-lavender)",
    temperament: "explores side paths",
    greeting: "high-fiving juno",
    noteReaction: "vetting sources",
    objectives: ["off to read the SDK", "off to trace a webhook"],
  },
  {
    id: "oki",
    name: "oki",
    color: "var(--agent-moss)",
    temperament: "tidies loose ends",
    greeting: "bowing to oki",
    noteReaction: "spot-checking",
    objectives: ["off to clear the backlog", "off to prune old flags"],
  },
  {
    id: "bea",
    name: "bea",
    color: "var(--agent-clay)",
    temperament: "draws the big shapes",
    greeting: "cheering bea",
    noteReaction: "marking up bea",
    objectives: ["off to rough in pricing", "off to draw the mobile view"],
  },
  {
    id: "tao",
    name: "tao",
    color: "var(--agent-tea)",
    temperament: "signs off the work",
    greeting: "tipping hat, tao",
    noteReaction: "holding sign-off",
    objectives: ["off to sign off a release", "off to run the full suite"],
  },
];

export function agent(id: AgentId): Agent {
  const found = AGENTS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown agent ${id}`);
  return found;
}
