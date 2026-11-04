export type AgentId = "ren" | "sol" | "ivo" | "mika" | "juno" | "oki" | "bea" | "tao";

export type Agent = {
  id: AgentId;
  name: string;
  /** CSS custom property holding the agent's pastel, theme-aware. */
  color: string;
  temperament: string;
  /** What the visitor's tag says hovering this agent in the crew row. */
  greeting: string;
  /** What the visitor's tag says hovering this agent's log note. */
  noteReaction: string;
};

export const AGENTS: readonly Agent[] = [
  {
    id: "ren",
    name: "ren",
    color: "var(--agent-sage)",
    temperament: "lays the first lines",
    greeting: "nodding at ren",
    noteReaction: "thanking ren",
  },
  {
    id: "sol",
    name: "sol",
    color: "var(--agent-ochre)",
    temperament: "writes the words",
    greeting: "waving at sol",
    noteReaction: "quoting sol",
  },
  {
    id: "ivo",
    name: "ivo",
    color: "var(--agent-ash)",
    temperament: "measures and aligns",
    greeting: "saluting ivo",
    noteReaction: "double-taking",
  },
  {
    id: "mika",
    name: "mika",
    color: "var(--agent-rose)",
    temperament: "reviews and refines",
    greeting: "smiling at mika",
    noteReaction: "agreeing, mika",
  },
  {
    id: "juno",
    name: "juno",
    color: "var(--agent-lavender)",
    temperament: "explores side paths",
    greeting: "high-fiving juno",
    noteReaction: "curious too",
  },
  {
    id: "oki",
    name: "oki",
    color: "var(--agent-moss)",
    temperament: "tidies loose ends",
    greeting: "bowing to oki",
    noteReaction: "crediting oki",
  },
  {
    id: "bea",
    name: "bea",
    color: "var(--agent-clay)",
    temperament: "draws the big shapes",
    greeting: "cheering bea",
    noteReaction: "applauding bea",
  },
  {
    id: "tao",
    name: "tao",
    color: "var(--agent-tea)",
    temperament: "signs off the work",
    greeting: "tipping hat, tao",
    noteReaction: "trusting tao",
  },
];

export function agent(id: AgentId): Agent {
  const found = AGENTS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown agent ${id}`);
  return found;
}
