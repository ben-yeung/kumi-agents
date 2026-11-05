import { AGENTS, type AgentId } from "@/lib/agents";
import type { Rng } from "@/lib/rng";
import type { BuildKind, Rewrite, Task } from "@/components/swarm/types";

/** Every build id in the hero (including the nav). Each choreography covers all of them. */
export const HERO_IDS = [
  "nav.joint",
  "nav.word",
  "nav.links",
  "nav.controls",
  "hero.copy",
  "hero.title",
  "hero.lede",
  "hero.cta",
  "hero.watch",
  "hero.enso",
  "hero.caption",
  "hero.crew",
] as const;

export type HeroId = (typeof HERO_IDS)[number];

export type Edge = "left" | "right" | "top" | "bottom";

type Step = {
  id: HeroId;
  kind?: BuildKind;
  /** Seconds before starting this step. */
  delay?: number;
  /** Stumble on a word and fix it (full runs only). */
  rewrite?: boolean;
  pace?: number;
};

export type Choreography = {
  name: string;
  /** One lane per agent; steps in a lane run in order. */
  lanes: Step[][];
  /** Where each lane's agent enters from (cycled if shorter than lanes). */
  entry: Edge[];
  /** Seconds each lane waits before its first step (cycled). */
  stagger?: number[];
  /** Ids that need no visible work in this choreography. */
  pass?: HeroId[];
  /** Extra cross-lane dependencies: [task, waitsFor]. */
  after?: [HeroId, HeroId][];
};

export const CHOREOGRAPHIES: readonly Choreography[] = [
  {
    // Four hands, each with a clear piece, working at once. The headline leads.
    name: "relay",
    entry: ["left", "right", "bottom", "top"],
    pass: ["hero.copy"],
    lanes: [
      [{ id: "hero.title", rewrite: true }],
      [{ id: "hero.enso", delay: 0.15 }, { id: "hero.caption" }, { id: "hero.crew" }],
      [{ id: "hero.lede", delay: 0.5, pace: 1.6 }, { id: "hero.cta" }, { id: "hero.watch" }],
      [{ id: "nav.joint" }, { id: "nav.word" }, { id: "nav.links" }, { id: "nav.controls" }],
    ],
  },
  {
    // One agent puts up scaffolding; the others fill it in.
    name: "scaffold",
    entry: ["left", "top", "right", "bottom", "left"],
    lanes: [
      [
        { id: "hero.copy", kind: "frame" },
        { id: "hero.title", rewrite: true },
      ],
      [{ id: "nav.joint", delay: 0.1 }, { id: "nav.word" }, { id: "nav.links" }],
      [{ id: "hero.lede", delay: 0.2, pace: 1.6 }],
      [{ id: "hero.enso" }, { id: "hero.caption" }, { id: "nav.controls" }],
      [{ id: "hero.cta", delay: 0.3 }, { id: "hero.watch" }, { id: "hero.crew" }],
    ],
  },
  {
    // The crew sweeps in from one side, a wave from top to bottom.
    name: "wave",
    entry: ["left"],
    stagger: [0, 0.15, 0.3, 0.45, 0.6],
    pass: ["hero.copy"],
    lanes: [
      [{ id: "hero.title" }],
      [{ id: "nav.joint" }, { id: "nav.word" }, { id: "nav.links" }],
      [{ id: "hero.lede", kind: "develop" }, { id: "hero.cta" }, { id: "hero.watch" }],
      [{ id: "hero.enso" }, { id: "hero.caption" }],
      [{ id: "nav.controls" }, { id: "hero.crew" }],
    ],
  },
  {
    // A small, calm crew. The ensō and the headline arrive together.
    name: "gathering",
    entry: ["bottom", "right", "left"],
    pass: ["hero.copy"],
    lanes: [
      [
        { id: "hero.title", rewrite: true },
        { id: "hero.lede", kind: "develop" },
        { id: "hero.cta" },
        { id: "hero.watch" },
      ],
      [{ id: "hero.enso" }, { id: "hero.caption" }],
      [
        { id: "nav.joint", delay: 0.3 },
        { id: "nav.word" },
        { id: "nav.links" },
        { id: "nav.controls" },
        { id: "hero.crew" },
      ],
    ],
  },
];

const REWRITES: Record<string, string[]> = {
  fit: ["cut", "joint", "seam"],
};

export type HeroPlan = {
  choreography: string;
  cast: AgentId[];
  entries: Edge[];
  /** Per hero task overrides applied over what the DOM declares. */
  overrides: Map<string, Partial<Task>>;
};

/**
 * Turns a choreography into concrete task overrides with a random cast.
 * Every visit plays at the same tempo; variety comes from the choreography,
 * the cast and small timing jitter.
 */
export function planHero(
  choreo: Choreography,
  rng: Rng,
  opts: { cast?: AgentId[] } = {},
): HeroPlan {
  const pool = opts.cast ?? rng.shuffle(AGENTS.map((a) => a.id));
  const cast = pool.slice(0, choreo.lanes.length);
  const overrides = new Map<string, Partial<Task>>();

  choreo.lanes.forEach((lane, laneIndex) => {
    const agent = cast[laneIndex];
    const stagger = choreo.stagger?.[laneIndex % choreo.stagger.length] ?? 0;
    lane.forEach((step, i) => {
      const prev = lane[i - 1];
      const jitter = rng.next() * 0.15;
      let rewrite: Rewrite | undefined;
      if (step.rewrite) {
        const word = Object.keys(REWRITES)[0];
        rewrite = { word, wrong: rng.pick(REWRITES[word]) };
      }
      overrides.set(step.id, {
        agent,
        order: i,
        after: prev ? [prev.id] : [],
        delay: (step.delay ?? 0) + (i === 0 ? stagger : 0) + jitter,
        ...(step.kind ? { kind: step.kind } : {}),
        rewrite,
        pace: step.pace,
      });
    });
  });

  for (const id of choreo.pass ?? []) {
    overrides.set(id, { kind: "pass", agent: undefined, after: [], delay: 0 });
  }

  for (const [id, waitsFor] of choreo.after ?? []) {
    const o = overrides.get(id);
    if (o) o.after = [...(o.after ?? []), waitsFor];
  }

  const entries = cast.map((_, i) => choreo.entry[i % choreo.entry.length]);
  return { choreography: choreo.name, cast, entries, overrides };
}

/** Picks a choreography, avoiding an immediate repeat of the last one. */
export function chooseChoreography(rng: Rng, last: string | null): Choreography {
  const options = CHOREOGRAPHIES.filter((c) => c.name !== last);
  return rng.pick(options.length ? options : CHOREOGRAPHIES);
}
