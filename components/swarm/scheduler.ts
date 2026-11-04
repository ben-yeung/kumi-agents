import type { AgentId } from "@/lib/agents";
import type { Task, TaskStatus } from "@/components/swarm/types";

export type SchedulerState = {
  tasks: readonly Task[];
  status: ReadonlyMap<string, TaskStatus>;
  activeSections: ReadonlySet<string>;
  /** Agents currently on the crew. */
  crew: readonly AgentId[];
};

/** A task can start when its section is live and everything it waits on is done. */
export function isReady(task: Task, state: SchedulerState) {
  if (state.status.has(task.id)) return false;
  if (!state.activeSections.has(task.section)) return false;
  if (task.parent && state.status.get(task.parent) !== "done") return false;
  return task.after.every((id) => state.status.get(id) === "done" || !hasTask(state, id));
}

function hasTask(state: SchedulerState, id: string) {
  return state.tasks.some((t) => t.id === id);
}

export function canTake(task: Task, agent: AgentId, state: SchedulerState) {
  // Assigned work falls back to anyone if its agent has left the crew.
  if (task.agent && state.crew.includes(task.agent)) return task.agent === agent;
  if (task.prefer && state.crew.includes(task.prefer)) return task.prefer === agent;
  return true;
}

/**
 * Picks the next task for an agent: lowest order first, nearest first among
 * equals. `distanceTo` lets the caller measure against live element positions.
 */
export function pickTask(
  agent: AgentId,
  state: SchedulerState,
  distanceTo: (task: Task) => number = () => 0,
): Task | null {
  let best: Task | null = null;
  let bestDist = Infinity;
  for (const task of state.tasks) {
    if (!isReady(task, state) || !canTake(task, agent, state)) continue;
    if (best === null || task.order < best.order) {
      best = task;
      bestDist = distanceTo(task);
      continue;
    }
    if (task.order === best.order) {
      const d = distanceTo(task);
      if (d < bestDist) {
        best = task;
        bestDist = d;
      }
    }
  }
  return best;
}

/** Ready work nobody has claimed yet; used to speed the crew up when behind. */
export function backlog(state: SchedulerState) {
  return state.tasks.filter((t) => isReady(t, state)).length;
}

/** Every task in a section is done. */
export function sectionDone(section: string, state: SchedulerState) {
  return state.tasks
    .filter((t) => t.section === section)
    .every((t) => state.status.get(t.id) === "done");
}
