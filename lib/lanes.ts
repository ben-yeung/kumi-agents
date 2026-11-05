import type { AgentId } from "@/lib/agents";
import type { Rng } from "@/lib/rng";

export type Step = { text: string; done: boolean };

export type Lane = {
  agent: AgentId;
  piece: string;
  /** What the visitor's tag says hovering this lane. */
  intent: string;
  steps: Step[];
  progress: number;
};

/** The project the whole crew is on, shown above their work. */
export const GOAL = "ship team billing";

/**
 * The agents' work on that goal, in workflow order: each piece builds on the
 * ones before it, so the earlier a piece is, the further along it starts.
 * Shown as eight notes, or the same steps as cards on a board.
 */
export const LANES: readonly Lane[] = [
  {
    agent: "juno",
    piece: "Choose a payments provider",
    intent: "skimming docs",
    steps: [
      { text: "compare two providers", done: true },
      { text: "test webhook signatures", done: true },
      { text: "write up the gotchas", done: false },
    ],
    progress: 0.88,
  },
  {
    agent: "ren",
    piece: "Build the billing data model",
    intent: "admiring schema",
    steps: [
      { text: "model plans and seats", done: true },
      { text: "write the migration", done: true },
      { text: "backfill existing teams", done: false },
    ],
    progress: 0.8,
  },
  {
    agent: "bea",
    piece: "Build the upgrade flow",
    intent: "sizing it up",
    steps: [
      { text: "lay out the plan picker", done: true },
      { text: "wire up checkout", done: true },
      { text: "add seat management", done: false },
    ],
    progress: 0.72,
  },
  {
    agent: "mika",
    piece: "Test failed payments",
    intent: "trusting tests",
    steps: [
      { text: "simulate declined cards", done: true },
      { text: "fix double charge on retry", done: true },
      { text: "cover mid-cycle upgrades", done: false },
    ],
    progress: 0.68,
  },
  {
    agent: "sol",
    piece: "Write the billing emails",
    intent: "proofing copy",
    steps: [
      { text: "name the plans", done: true },
      { text: "write receipt emails", done: false },
      { text: "soften the failed-card notice", done: false },
    ],
    progress: 0.52,
  },
  {
    agent: "ivo",
    piece: "Reconcile invoice totals",
    intent: "checking sums",
    steps: [
      { text: "replay a month of usage", done: true },
      { text: "find the rounding drift", done: false },
      { text: "match invoices to the cent", done: false },
    ],
    progress: 0.46,
  },
  {
    agent: "oki",
    piece: "Retire the old invoicing",
    intent: "sweeping up",
    steps: [
      { text: "list what still uses it", done: true },
      { text: "move old plans over", done: false },
      { text: "remove the dead routes", done: false },
    ],
    progress: 0.4,
  },
  {
    agent: "tao",
    piece: "Fit and ship the release",
    intent: "checking joints",
    steps: [
      { text: "line up the merge order", done: true },
      { text: "run checkout end to end", done: false },
      { text: "roll out behind a flag", done: false },
    ],
    progress: 0.36,
  },
];

export type CardStatus = "planned" | "doing" | "done";

export const COLUMNS: readonly { status: CardStatus; title: string; intent: string }[] = [
  { status: "planned", title: "Planned", intent: "peeking ahead" },
  { status: "doing", title: "In progress", intent: "watching hands" },
  { status: "done", title: "Completed", intent: "tallying up" },
];

export type Card = {
  id: string;
  agent: AgentId;
  piece: string;
  text: string;
  intent: string;
  status: CardStatus;
  /** The lane's progress, shown only on the card being worked on. */
  progress: number;
};

export type Work = {
  lanes: readonly Lane[];
  /** Cards most recently moved, newest first; they sit at the top of their column. */
  recent: readonly string[];
  /** Cards whose turn has come but which have not been dragged across yet. */
  waiting: readonly string[];
};

export const INITIAL_WORK: Work = { lanes: LANES, recent: [], waiting: [] };

function cardId(agent: AgentId, step: number) {
  return `${agent}-${step}`;
}

function nextStep(lane: Lane) {
  return lane.steps.findIndex((s) => !s.done);
}

export function isFinished(lane: Lane) {
  return nextStep(lane) === -1;
}

/** Every step as a card. Each agent holds one at a time, the rest wait their turn. */
export function cards(work: Work): Card[] {
  return work.lanes.flatMap((lane) =>
    lane.steps.map((step, i): Card => {
      const id = cardId(lane.agent, i);
      const turn = i === nextStep(lane) && !work.waiting.includes(id);
      return {
        id,
        agent: lane.agent,
        piece: lane.piece,
        text: step.text,
        intent: lane.intent,
        status: step.done ? "done" : turn ? "doing" : "planned",
        progress: lane.progress,
      };
    }),
  );
}

/** Cards in a column, the ones moved most recently first. */
export function column(work: Work, status: CardStatus) {
  const rank = (c: Card) => {
    const i = work.recent.indexOf(c.id);
    return i === -1 ? Infinity : i;
  };
  return cards(work)
    .filter((c) => c.status === status)
    .sort((a, b) => (rank(a) === rank(b) ? 0 : rank(a) - rank(b)));
}

export type Visit = {
  agent: AgentId;
  from: number;
  to: number;
  /** The step this visit finishes, if any. */
  tick: number | null;
};

const MIN_STEP = 0.05;
const MAX_STEP = 0.12;

/**
 * What an agent does on one visit: moves progress on, finishing their current
 * step once progress has passed its share. The last step closes out at 100%.
 */
export function planVisit(lane: Lane, rng: Rng): Visit | null {
  const step = nextStep(lane);
  if (step === -1) return null;
  const from = lane.progress;
  const left = lane.steps.length - step;
  const moved = from + MIN_STEP + rng.next() * (MAX_STEP - MIN_STEP);
  // Work left over never reads as finished.
  const to = left > 1 ? Math.min(moved, 0.95) : moved >= 0.96 ? 1 : moved;
  const share = (step + 1) / lane.steps.length;
  return { agent: lane.agent, from, to, tick: to >= share ? step : null };
}

function withLane(work: Work, agent: AgentId, change: (lane: Lane) => Lane): Work {
  return { ...work, lanes: work.lanes.map((l) => (l.agent === agent ? change(l) : l)) };
}

export function setProgress(work: Work, agent: AgentId, progress: number): Work {
  return withLane(work, agent, (l) => ({ ...l, progress }));
}

/**
 * Marks a step done. On the board `hold` keeps the next card in Planned until
 * the agent drags it across.
 */
export function finishStep(work: Work, agent: AgentId, step: number, hold = false): Work {
  const next = withLane(work, agent, (l) => ({
    ...l,
    steps: l.steps.map((s, i) => (i === step ? { ...s, done: true } : s)),
  }));
  const lane = next.lanes.find((l) => l.agent === agent)!;
  const upcoming = nextStep(lane);
  return {
    ...next,
    recent: [cardId(agent, step), ...next.recent],
    waiting: hold && upcoming !== -1 ? [...next.waiting, cardId(agent, upcoming)] : next.waiting,
  };
}

/** The card an agent has left waiting in Planned, if any. */
export function heldCard(work: Work, agent: AgentId) {
  return work.waiting.find((id) => id.startsWith(`${agent}-`)) ?? null;
}

/** The held card moves over to In progress. */
export function startCard(work: Work, id: string): Work {
  return {
    ...work,
    recent: [id, ...work.recent],
    waiting: work.waiting.filter((w) => w !== id),
  };
}

/** Where the visit ends up, whatever got interrupted along the way. */
export function settleVisit(work: Work, visit: Visit): Work {
  const lane = work.lanes.find((l) => l.agent === visit.agent)!;
  const ticked = visit.tick === null || lane.steps[visit.tick].done;
  const after = ticked ? work : finishStep(work, visit.agent, visit.tick!);
  const held = heldCard(after, visit.agent);
  return {
    ...setProgress(after, visit.agent, visit.to),
    waiting: after.waiting.filter((id) => id !== held),
  };
}

/** Whoever has gone longest without a visit, among those the visitor can see. */
export function pickLane(
  lanes: readonly Lane[],
  visible: readonly AgentId[],
  lastVisit: ReadonlyMap<AgentId, number>,
): Lane | null {
  const open = lanes.filter((l) => visible.includes(l.agent) && !isFinished(l));
  let best: Lane | null = null;
  let bestAt = Infinity;
  for (const lane of open) {
    const at = lastVisit.get(lane.agent) ?? -1;
    if (at < bestAt) {
      best = lane;
      bestAt = at;
    }
  }
  return best;
}
