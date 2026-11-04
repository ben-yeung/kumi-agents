export type AgentId = "ren" | "sol" | "ivo" | "mika" | "juno" | "oki" | "bea" | "tao";

export type Agent = {
  id: AgentId;
  name: string;
  /** CSS custom property holding the agent's pastel, theme-aware. */
  color: string;
  temperament: string;
};

export const AGENTS: readonly Agent[] = [
  { id: "ren", name: "ren", color: "var(--agent-sage)", temperament: "lays the first lines" },
  { id: "sol", name: "sol", color: "var(--agent-ochre)", temperament: "writes the words" },
  { id: "ivo", name: "ivo", color: "var(--agent-ash)", temperament: "measures and aligns" },
  { id: "mika", name: "mika", color: "var(--agent-rose)", temperament: "reviews and refines" },
  {
    id: "juno",
    name: "juno",
    color: "var(--agent-lavender)",
    temperament: "explores side strands",
  },
  { id: "oki", name: "oki", color: "var(--agent-moss)", temperament: "tidies loose ends" },
  { id: "bea", name: "bea", color: "var(--agent-clay)", temperament: "draws the big shapes" },
  { id: "tao", name: "tao", color: "var(--agent-tea)", temperament: "signs off the work" },
];

export function agent(id: AgentId): Agent {
  const found = AGENTS.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown agent ${id}`);
  return found;
}
