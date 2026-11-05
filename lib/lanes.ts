import type { AgentId } from "@/lib/agents";
import type { Rng } from "@/lib/rng";

export type Step = { text: string; done: boolean };

/** A piece of work as it is written down, before or after it is worked on. */
export type Piece = { piece: string; steps: readonly string[] };

type Plan = {
  agent: AgentId;
  piece: string;
  /** What the visitor's tag says hovering this lane. */
  intent: string;
  steps: Step[];
  progress: number;
  /** What the agent adds once the current piece is finished. */
  backlog: readonly Piece[];
};

export type Lane = Plan & {
  /** Pieces this agent has finished, oldest first. */
  past: readonly Piece[];
  /** Steps of the current piece written down so far. */
  written: number;
};

/** The project the whole crew is on, shown above their work. */
export const GOAL = "ship team billing";

/**
 * The agents' work on that goal, in workflow order: each piece builds on the
 * ones before it, so the earlier a piece is, the further along it starts.
 * Each lane finishes by adding the next piece from its backlog.
 * Shown as eight notes, or the same steps as cards on a board.
 */
const PLANS: readonly Plan[] = [
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
    backlog: [
      {
        piece: "Research sales tax rules",
        steps: ["list where teams are based", "compare tax services", "write up the rollout order"],
      },
      {
        piece: "Plan for card updates",
        steps: ["read the card updater docs", "check expiry webhooks", "note the retry windows"],
      },
    ],
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
    backlog: [
      {
        piece: "Add usage tracking",
        steps: ["record seat changes", "roll usage up by day", "index the busy queries"],
      },
      {
        piece: "Build the invoices table",
        steps: ["store line items", "link invoices to teams", "add the download route"],
      },
    ],
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
    backlog: [
      {
        piece: "Build the billing page",
        steps: ["show the current plan", "list past invoices", "add the change card form"],
      },
      {
        piece: "Build the seat controls",
        steps: [
          "invite from the billing page",
          "show the prorated cost",
          "confirm before removing seats",
        ],
      },
    ],
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
    backlog: [
      {
        piece: "Test seat changes",
        steps: ["add seats mid-cycle", "remove the last admin", "check prorated invoices"],
      },
      {
        piece: "Load test the webhooks",
        steps: ["replay a burst of events", "drop duplicate events", "measure the queue delay"],
      },
    ],
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
    backlog: [
      {
        piece: "Write the billing help pages",
        steps: ["explain seat pricing", "answer the refund question", "show how to cancel"],
      },
      {
        piece: "Write the upgrade prompts",
        steps: [
          "draft the plan comparison",
          "name the seat limit warning",
          "tidy the checkout labels",
        ],
      },
    ],
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
    backlog: [
      {
        piece: "Audit the tax lines",
        steps: ["sample a month of invoices", "check the tax rounding", "flag the missing VAT IDs"],
      },
      {
        piece: "Forecast plan revenue",
        steps: ["pull seats by plan", "model the annual discount", "check it against the ledger"],
      },
    ],
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
    backlog: [
      {
        piece: "Clear the old webhooks",
        steps: ["find unused endpoints", "move retries to the queue", "delete the stale handlers"],
      },
      {
        piece: "Clean up old feature flags",
        steps: ["list flags past rollout", "remove the checkout flag", "drop the unused columns"],
      },
    ],
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
    backlog: [
      {
        piece: "Roll out to all teams",
        steps: ["start with ten percent", "watch the error rate", "open it to everyone"],
      },
      {
        piece: "Hand over to support",
        steps: ["write the on-call notes", "share the refund runbook", "close the billing project"],
      },
    ],
  },
];

export const LANES: readonly Lane[] = PLANS.map((plan) => ({
  ...plan,
  past: [],
  written: plan.steps.length,
}));

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
  /** How far along this step is, shown only on the card being worked on. */
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

function cardId(agent: AgentId, piece: number, step: number) {
  return `${agent}-${piece}-${step}`;
}

function currentCardId(lane: Lane, step: number) {
  return cardId(lane.agent, lane.past.length, step);
}

function nextStep(lane: Lane) {
  return lane.steps.findIndex((s) => !s.done);
}

export function isFinished(lane: Lane) {
  return nextStep(lane) === -1;
}

/** Whether the agent still has anything to do, here or in their backlog. */
export function hasWork(lane: Lane) {
  return !isFinished(lane) || lane.backlog.length > 0;
}

/** How far through one step the lane has got, from 0 to 1. */
function stepProgress(lane: Lane, step: number) {
  return Math.min(Math.max(lane.progress * lane.steps.length - step, 0), 1);
}

function pastCards(lane: Lane): Card[] {
  return lane.past.flatMap(({ piece, steps }, p) =>
    steps.map((text, i) => ({
      id: cardId(lane.agent, p, i),
      agent: lane.agent,
      piece,
      text,
      intent: lane.intent,
      status: "done",
      progress: 1,
    })),
  );
}

/** Every step as a card. Each agent holds one at a time, the rest wait their turn. */
export function cards(work: Work): Card[] {
  return work.lanes.flatMap((lane) => [
    ...pastCards(lane),
    ...lane.steps.slice(0, lane.written).map((step, i): Card => {
      const id = currentCardId(lane, i);
      const turn = i === nextStep(lane) && !work.waiting.includes(id);
      return {
        id,
        agent: lane.agent,
        piece: lane.piece,
        text: step.text,
        intent: lane.intent,
        status: step.done ? "done" : turn ? "doing" : "planned",
        progress: stepProgress(lane, i),
      };
    }),
  ]);
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

/** What an agent does on the board: takes the card to 100%, which finishes it. */
export function planCardVisit(lane: Lane): Visit | null {
  const step = nextStep(lane);
  if (step === -1) return null;
  const to = (step + 1) / lane.steps.length;
  return { agent: lane.agent, from: lane.progress, to, tick: step };
}

function laneOf(work: Work, agent: AgentId) {
  return work.lanes.find((l) => l.agent === agent)!;
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
  const lane = laneOf(next, agent);
  const upcoming = nextStep(lane);
  return {
    ...next,
    recent: [currentCardId(lane, step), ...next.recent],
    waiting:
      hold && upcoming !== -1 ? [...next.waiting, currentCardId(lane, upcoming)] : next.waiting,
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
  const lane = laneOf(work, visit.agent);
  const ticked = visit.tick === null || lane.steps[visit.tick].done;
  const after = ticked ? work : finishStep(work, visit.agent, visit.tick!);
  const held = heldCard(after, visit.agent);
  return {
    ...setProgress(after, visit.agent, visit.to),
    waiting: after.waiting.filter((id) => id !== held),
  };
}

/**
 * A finished agent takes the next piece from their backlog. Nothing of it is
 * written yet, and its first card waits in Planned until it is dragged across.
 */
export function openPiece(work: Work, agent: AgentId): Work {
  const lane = laneOf(work, agent);
  const [next, ...backlog] = lane.backlog;
  if (!next || !isFinished(lane)) return work;
  const opened: Lane = {
    ...lane,
    past: [...lane.past, { piece: lane.piece, steps: lane.steps.map((s) => s.text) }],
    piece: next.piece,
    steps: next.steps.map((text) => ({ text, done: false })),
    progress: 0,
    backlog,
    written: 0,
  };
  return {
    ...withLane(work, agent, () => opened),
    waiting: [...work.waiting, currentCardId(opened, 0)],
  };
}

/** The card the next written step becomes, if any are left to write. */
export function nextToWrite(lane: Lane) {
  return lane.written < lane.steps.length ? currentCardId(lane, lane.written) : null;
}

/** Writes the next step down, under the steps already written so they read in order. */
export function writeStep(work: Work, agent: AgentId): Work {
  const lane = laneOf(work, agent);
  const id = nextToWrite(lane);
  if (!id) return work;
  const piece = currentCardId(lane, 0).slice(0, -1);
  const at = work.recent.map((c) => c.startsWith(piece)).lastIndexOf(true) + 1;
  return {
    ...withLane(work, agent, (l) => ({ ...l, written: l.written + 1 })),
    recent: [...work.recent.slice(0, at), id, ...work.recent.slice(at)],
  };
}

/** Where adding a piece ends up, whatever got interrupted along the way. */
export function settleOpening(work: Work, agent: AgentId): Work {
  const opened = openPiece(work, agent);
  const held = heldCard(opened, agent);
  return {
    ...withLane(opened, agent, (l) => ({ ...l, written: l.steps.length })),
    waiting: opened.waiting.filter((id) => id !== held),
  };
}

/** Whoever has gone longest without a visit, among those the visitor can see. */
export function pickLane(
  lanes: readonly Lane[],
  visible: readonly AgentId[],
  lastVisit: ReadonlyMap<AgentId, number>,
): Lane | null {
  const open = lanes.filter((l) => visible.includes(l.agent) && hasWork(l));
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
