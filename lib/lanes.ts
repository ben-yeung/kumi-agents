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

/** The agents' work: eight notes, or the same steps as cards on a board. */
export const LANES: readonly Lane[] = [
  {
    agent: "ren",
    piece: "Draft data model",
    intent: "admiring schema",
    steps: [
      { text: "sketch entities", done: true },
      { text: "name relations", done: true },
      { text: "write schema", done: false },
    ],
    progress: 0.72,
  },
  {
    agent: "sol",
    piece: "Write onboarding copy",
    intent: "proofing copy",
    steps: [
      { text: "read brief", done: true },
      { text: "first pass, plain words", done: false },
      { text: "trim by a third", done: false },
    ],
    progress: 0.41,
  },
  {
    agent: "ivo",
    piece: "Align new screens",
    intent: "eyeing the grid",
    steps: [
      { text: "measure spacing", done: true },
      { text: "set type scale", done: true },
      { text: "even out margins", done: false },
    ],
    progress: 0.64,
  },
  {
    agent: "mika",
    piece: "Tighten test suite",
    intent: "trusting tests",
    steps: [
      { text: "find flaky ones", done: true },
      { text: "fix clock", done: true },
      { text: "add edge cases", done: false },
    ],
    progress: 0.93,
  },
  {
    agent: "juno",
    piece: "Read payments docs",
    intent: "skimming docs",
    steps: [
      { text: "skim guides", done: true },
      { text: "note webhooks", done: false },
      { text: "flag gotchas", done: false },
    ],
    progress: 0.28,
  },
  {
    agent: "oki",
    piece: "Clear out old helpers",
    intent: "sweeping up",
    steps: [
      { text: "find unused code", done: true },
      { text: "rename flags", done: false },
      { text: "remove dead routes", done: false },
    ],
    progress: 0.36,
  },
  {
    agent: "bea",
    piece: "Rough in settings page",
    intent: "sizing it up",
    steps: [
      { text: "block out layout", done: true },
      { text: "two columns, not three", done: true },
      { text: "draw mobile view", done: false },
    ],
    progress: 0.58,
  },
  {
    agent: "tao",
    piece: "Check that pieces fit",
    intent: "checking joints",
    steps: [
      { text: "compare pieces", done: true },
      { text: "run full suite", done: false },
      { text: "sign off work", done: false },
    ],
    progress: 0.19,
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

const MIN_STEP = 0.1;
const MAX_STEP = 0.22;

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
    waiting: hold && upcoming !== -1 ? [cardId(agent, upcoming)] : next.waiting,
  };
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
  return { ...setProgress(after, visit.agent, visit.to), waiting: [] };
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
