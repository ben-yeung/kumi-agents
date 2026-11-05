import type { AgentId } from "@/lib/agents";

/** How many hands stay around while nothing needs building. */
export function restingCrew(maxCrew: number) {
  return maxCrew > 4 ? { min: 1, max: 3 } : { min: 1, max: 2 };
}

/**
 * Who comes in next: the agent away the longest, and anyone not yet seen
 * before them. Ties keep the order of `all`, so callers can shuffle it.
 */
export function nextArrival(
  all: readonly AgentId[],
  present: readonly AgentId[],
  lastSeen: ReadonlyMap<AgentId, number>,
): AgentId | null {
  let best: AgentId | null = null;
  let bestSeen = Infinity;
  for (const id of all) {
    const seen = lastSeen.get(id) ?? -1;
    if (!present.includes(id) && seen < bestSeen) {
      best = id;
      bestSeen = seen;
    }
  }
  return best;
}
