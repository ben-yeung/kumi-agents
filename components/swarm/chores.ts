import type { PointerVariant } from "@/components/ui/Pointer";
import type { AgentId } from "@/lib/agents";
import type { Rng } from "@/lib/rng";
import type { BuildKind } from "@/components/swarm/types";

/** Something an agent does to finished work when nothing is assigned to them. */
export type Chore = {
  label: string;
  tool: PointerVariant;
  on: readonly BuildKind[];
  /** Leaves a dotted guide over the work while the agent measures it. */
  guide?: boolean;
};

const TEXT: readonly BuildKind[] = ["type", "develop"];
const SHAPES: readonly BuildKind[] = ["box", "frame", "stroke"];
const PLACED: readonly BuildKind[] = ["reveal", "list"];
const ANY = [...TEXT, ...SHAPES, ...PLACED];

/** Each agent keeps to their own craft, so the crew never all do the same thing. */
export const CHORES: Record<AgentId, readonly Chore[]> = {
  ren: [
    { label: "annotating the plan", tool: "pencil", on: SHAPES },
    { label: "adding a margin note", tool: "pencil", on: TEXT },
  ],
  sol: [
    { label: "tightening a line", tool: "ibeam", on: TEXT },
    { label: "sharpening the copy", tool: "ibeam", on: TEXT },
  ],
  ivo: [
    { label: "measuring spacing", tool: "cross", on: ANY, guide: true },
    { label: "squaring it to the grid", tool: "cross", on: SHAPES, guide: true },
  ],
  mika: [
    { label: "reviewing the work", tool: "loupe", on: ANY },
    { label: "trying an edge case", tool: "loupe", on: SHAPES },
  ],
  juno: [
    { label: "tracing a side path", tool: "loupe", on: ANY },
    { label: "looking something up", tool: "hand", on: PLACED },
  ],
  oki: [
    { label: "clearing a loose end", tool: "hand", on: PLACED },
    { label: "tucking in an edge", tool: "hand", on: SHAPES },
  ],
  bea: [
    { label: "blocking out a variant", tool: "cross", on: SHAPES, guide: true },
    { label: "sketching an alternative", tool: "pencil", on: SHAPES },
  ],
  tao: [
    { label: "testing a joint", tool: "loupe", on: SHAPES },
    { label: "checking the fit", tool: "hand", on: PLACED },
  ],
};

/** For when nothing nearby needs a hand. */
export const PLANS: readonly string[] = [
  "planning the next piece",
  "sorting the queue",
  "scoping what's next",
];

/** Chores in one section on a visit; the rest of it does not need the extra hands. */
export const CHORES_PER_SECTION = 4;

/**
 * What is left to go over. `group` is the whole piece an element belongs to, so
 * a note gets one pass rather than one each for its title, list and rule.
 */
export function freshWork<T extends { group: unknown; section: string }>(
  options: readonly T[],
  checked: ReadonlySet<unknown>,
  doneIn: ReadonlyMap<string, number>,
): T[] {
  return options.filter(
    (o) => !checked.has(o.group) && (doneIn.get(o.section) ?? 0) < CHORES_PER_SECTION,
  );
}

/** A chore this agent can do on work of this kind, never the one they just did. */
export function pickChore(rng: Rng, agent: AgentId, kind: BuildKind, last: string | null) {
  const fits = CHORES[agent].filter((c) => c.on.includes(kind));
  const varied = fits.filter((c) => c.label !== last);
  return varied.length ? rng.pick(varied) : fits.length ? fits[0] : null;
}

/** Something to plan, never the same thing twice running. */
export function pickPlan(rng: Rng, last: string | null) {
  return rng.pick(PLANS.filter((p) => p !== last));
}
