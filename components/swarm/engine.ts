import { AGENTS, agent as agentById, type AgentId } from "@/lib/agents";
import { distance, type Point } from "@/lib/paths";
import { createRng, randomSeed, type Rng } from "@/lib/rng";
import { Aborted, AgentRuntime, type Clock } from "@/components/swarm/agent";
import {
  chooseChoreography,
  planHero,
  type Edge,
  type HeroPlan,
} from "@/components/swarm/choreographies";
import { DEFAULT_LABELS, markBuilt, rectOf, runEffect, unbuild } from "@/components/swarm/effects";
import { BUILD_ADD_EVENT, CREW_ERRAND_EVENT, SECTION_BUILT_EVENT } from "@/components/swarm/build";
import { nextArrival, restingCrew } from "@/components/swarm/roster";
import {
  backlog,
  missingOwners,
  pickTask,
  sectionDone,
  type SchedulerState,
} from "@/components/swarm/scheduler";
import {
  BUILD_KINDS,
  type BuildKind,
  type Errand,
  type Task,
  type TaskStatus,
} from "@/components/swarm/types";

export const HERO_SECTION = "hero";

const LAST_CHOREO_KEY = "kumi-last-choreo";

const IDLE_ACTIONS = [
  "resting",
  "stretching",
  "waiting",
  "pausing",
  "tidying",
  "checking in",
  "looking around",
];

export type Phase = "intro" | "settled";

/**
 * Global tempo for everything the crew does (moves, typing, drawing, fades).
 * Lower is slower and calmer. Every visit plays at this tempo.
 */
const TEMPO = 0.6;
/** How much the crew may hurry when work piles up (e.g. a fast scroll). */
const MAX_CATCH_UP = 1.35;

/** A new section never starts with fewer hands than this. */
const MIN_BUILD_CREW = 3;

/** How long an agent stays when nothing needs them (ms). */
const SHIFT_MS: [number, number] = [20_000, 40_000];
/** How long an agent lingers after a job they were called in for (ms). */
const AFTER_JOB_MS: [number, number] = [4000, 12_000];
/** How often the crew looks for a fresh pair of hands (ms). */
const ARRIVAL_MS: [number, number] = [6000, 11_000];

const ENTRY_EDGES: Edge[] = ["left", "right", "bottom"];

type Options = {
  overlay: HTMLElement;
  onCrew: (crew: AgentRuntime[]) => void;
  onPhase: (phase: Phase) => void;
  /** From a previous run: agents stay where they are and carry on. */
  handoff?: Handoff | null;
};

export type Handoff = {
  crew: { id: AgentId; point: Point }[];
  /** Choreography that just played, so a replay differs from it. */
  choreography: string | null;
};

/**
 * The choreography the previous page load used, read once per page load so
 * remounts (React Strict Mode in dev) cannot see their own choice as "last".
 */
let previousChoreography: string | null | undefined;
function lastChoreography() {
  if (previousChoreography === undefined) previousChoreography = session(LAST_CHOREO_KEY);
  return previousChoreography;
}

function session(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Without storage every visit simply plays the full intro.
  }
}

/**
 * Runs the crew: reads `[data-build]` elements from the page, turns them into
 * tasks, and lets agents claim and build them in parallel. The hero follows a
 * choreography; later sections are claimed as they scroll into view.
 */
export class SwarmEngine {
  private rng: Rng = createRng(randomSeed());
  private base = new Map<string, Task>();
  private tasks: Task[] = [];
  private els = new Map<string, HTMLElement>();
  private status = new Map<string, TaskStatus>();
  private active = new Set<string>();
  private crew: AgentRuntime[] = [];
  private waiters = new Set<() => void>();
  private scaffolds = new Map<string, () => void>();
  private seq = 0;
  private aborted = false;
  private skipping = false;
  private plan: HeroPlan | null = null;
  private phase: Phase = "intro";
  private io: IntersectionObserver | null = null;
  private maxCrew = 8;
  /** Bumped whenever an agent stops idling, so a stale wander never moves it. */
  private idleToken = new Map<AgentId, number>();
  /** When each agent's shift ends. */
  private shiftEnd = new Map<AgentId, number>();
  /** Agents who came in for a job and head off soon after it. */
  private calledIn = new Set<AgentId>();
  /** When each agent was last on the crew, so everyone gets a turn. */
  private lastSeen = new Map<AgentId, number>();
  private arrivalTimer = 0;
  /** Undo work for effects in progress, run synchronously on teardown. */
  private teardowns = new Set<() => void>();
  /** Agents on their way out; still drawn, but no longer counted as crew. */
  private leaving = new Set<AgentRuntime>();

  private clock: Clock = {
    aborted: () => this.aborted,
    skipping: () => this.skipping,
    speed: () => this.speed(),
  };

  constructor(private opts: Options) {}

  /* ------------------------------------------------------------ lifecycle */

  start() {
    const root = document.documentElement;
    root.setAttribute("data-swarm", "live");
    this.maxCrew = window.innerWidth < 640 ? 4 : 8;

    document.querySelectorAll<HTMLElement>("[data-build]").forEach((el) => this.register(el));

    const inherited = (this.opts.handoff?.crew ?? []).map(({ id, point }) => {
      const runtime = new AgentRuntime(agentById(id), point, this.clock, this.rng);
      this.crew.push(runtime);
      return runtime;
    });
    if (inherited.length) this.opts.onCrew([...this.crew]);

    this.planIntro();

    this.observeSections();
    this.activate(HERO_SECTION);
    window.addEventListener(BUILD_ADD_EVENT, this.onBuildAdd);
    window.addEventListener(CREW_ERRAND_EVENT, this.onErrand);
    window.addEventListener("scroll", this.onScroll, { passive: true });
    inherited.forEach((runtime) => void this.run(runtime));
  }

  /** What a following run needs in order to pick up where this one stops. */
  handoff(): Handoff {
    return {
      crew: this.working().map((a) => ({ id: a.id, point: a.pos() })),
      choreography: this.plan?.choreography ?? null,
    };
  }

  destroy() {
    this.aborted = true;
    this.io?.disconnect();
    window.clearTimeout(this.arrivalTimer);
    window.removeEventListener(BUILD_ADD_EVENT, this.onBuildAdd);
    window.removeEventListener(CREW_ERRAND_EVENT, this.onErrand);
    window.removeEventListener("scroll", this.onScroll);
    this.crew.forEach((a) => a.stop());
    this.wake();
    // Effects caught mid-way undo themselves now, before anything is rebuilt.
    this.teardowns.forEach((undo) => undo());
    this.teardowns.clear();
    this.opts.overlay.querySelectorAll("[data-fx]").forEach((n) => n.remove());
    this.els.forEach((el) => unbuild(el));
    document.documentElement.removeAttribute("data-swarm");
  }

  /** Finish the intro instantly. */
  skip() {
    if (this.phase !== "intro") return;
    this.skipping = true;
    this.wake();
  }

  /* -------------------------------------------------------------- tasks */

  private register(el: HTMLElement, order?: number) {
    if (el.dataset.buildId && this.els.get(el.dataset.buildId) === el) return;
    const id = el.dataset.buildId || `b${this.seq}`;
    el.dataset.buildId = id;
    const kindAttr = el.dataset.build as BuildKind;
    const kind = BUILD_KINDS.includes(kindAttr) ? kindAttr : "reveal";
    const parentEl = el.parentElement?.closest<HTMLElement>("[data-build]");
    const ownerAttr = el.closest<HTMLElement>("[data-build-agent]")?.dataset.buildAgent;
    const task: Task = {
      id,
      kind,
      section: el.closest<HTMLElement>("[data-build-section]")?.dataset.buildSection ?? "page",
      order: order ?? this.seq,
      after: (el.dataset.buildAfter ?? "").split(",").filter(Boolean),
      parent: parentEl?.dataset.buildId ?? null,
      owner: AGENTS.some((a) => a.id === ownerAttr) ? (ownerAttr as AgentId) : undefined,
      label: el.dataset.buildLabel ?? DEFAULT_LABELS[kind],
      pace: Number(el.dataset.buildPace) || undefined,
    };
    this.seq++;
    this.base.set(id, task);
    this.els.set(id, el);
    this.tasks.push({ ...task });
  }

  private onBuildAdd = (e: Event) => {
    const el = (e as CustomEvent<HTMLElement>).detail;
    if (!(el instanceof HTMLElement)) return;
    this.register(el, 10_000 + this.seq);
    this.callIn();
    this.wake();
  };

  private onErrand = (e: Event) => {
    const { agent, label, section, el, run } = (e as CustomEvent<Errand>).detail;
    const id = `errand-${this.seq}`;
    this.els.set(id, el);
    this.tasks.push({
      id,
      kind: "pass",
      section,
      order: 10_000 + this.seq++,
      after: [],
      parent: null,
      owner: agent,
      label,
      errand: run,
    });
    this.callIn();
    this.wake();
  };

  private planIntro() {
    const choreo = chooseChoreography(
      this.rng,
      this.opts.handoff?.choreography ?? lastChoreography(),
    );
    setSession(LAST_CHOREO_KEY, choreo.name);
    // Agents carried over from a replay go first; new ones fill remaining lanes.
    const onCrew = this.working().map((a) => a.id);
    // New hands are fresh agents, never one that is on its way out.
    const present = this.crew.map((a) => a.id);
    const others = this.rng.shuffle(AGENTS.map((a) => a.id).filter((id) => !present.includes(id)));
    const plan = planHero(choreo, this.rng, {
      cast: [...this.rng.shuffle(onCrew), ...others],
    });
    this.plan = plan;
    this.setPhase("intro");

    this.tasks = this.tasks.map((t) => {
      const o = plan.overrides.get(t.id);
      const base = this.base.get(t.id)!;
      return o ? { ...base, ...o } : t;
    });
    if (this.active.has(HERO_SECTION)) this.completePasses(HERO_SECTION);

    plan.cast.forEach((id, i) => {
      if (!this.crew.some((a) => a.id === id)) this.spawn(id, plan.entries[i]);
    });
  }

  /* ------------------------------------------------------------- crew */

  private spawn(id: AgentId, edge: Edge) {
    if (this.crew.some((a) => a.id === id)) return;
    const runtime = new AgentRuntime(agentById(id), this.entryPoint(edge), this.clock, this.rng);
    this.crew.push(runtime);
    this.lastSeen.set(id, performance.now());
    this.opts.onCrew([...this.crew]);
    void this.run(runtime);
  }

  private entryPoint(edge: Edge): Point {
    const sx = window.scrollX;
    const sy = window.scrollY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const r = () => 0.15 + this.rng.next() * 0.7;
    switch (edge) {
      case "left":
        return { x: sx - 30, y: sy + vh * r() };
      case "right":
        return { x: sx + vw + 30, y: sy + vh * r() };
      case "top":
        return { x: sx + vw * r(), y: sy - 30 };
      case "bottom":
        return { x: sx + vw * r(), y: sy + vh + 30 };
    }
  }

  /** Brings in everyone whose name is on ready work. */
  private callIn() {
    for (const id of missingOwners(this.state())) {
      const walkingOut = [...this.leaving].find((a) => a.id === id);
      if (walkingOut) this.recall(walkingOut);
      else if (this.working().length < this.maxCrew) {
        this.calledIn.add(id);
        this.spawn(id, this.rng.pick(ENTRY_EDGES));
      }
    }
  }

  /** Whoever has been away longest comes in, so every agent gets a turn. */
  private bringFreshHands(count: number) {
    for (let i = 0; i < count; i++) {
      const present = this.crew.map((a) => a.id);
      const all = this.rng.shuffle(AGENTS.map((a) => a.id));
      const id = nextArrival(all, present, this.lastSeen);
      if (id) this.spawn(id, this.rng.pick(ENTRY_EDGES));
    }
  }

  /** New sections bring new hands: everyone named, or a few to share the work. */
  private grow() {
    const named = missingOwners(this.state()).length > 0;
    this.callIn();
    const free = this.maxCrew - this.working().length;
    const short = Math.max(MIN_BUILD_CREW - this.working().length, named ? 0 : 1);
    this.bringFreshHands(Math.max(0, Math.min(free, short)));
  }

  private state(): SchedulerState {
    return {
      tasks: this.tasks,
      status: this.status,
      activeSections: this.active,
      crew: this.working().map((a) => a.id),
    };
  }

  private working() {
    return this.crew.filter((a) => !this.leaving.has(a));
  }

  private speed() {
    const behind = Math.max(0, backlog(this.state()) - 4);
    return TEMPO * Math.min(1 + behind * 0.05, MAX_CATCH_UP);
  }

  private async run(agent: AgentRuntime) {
    try {
      while (!this.aborted) {
        const here = agent.pos();
        const task = pickTask(agent.id, this.state(), (t) => this.distanceTo(t, here));
        if (!task) {
          if (await this.idle(agent)) return;
          continue;
        }
        this.status.set(task.id, "claimed");
        this.idleToken.set(agent.id, (this.idleToken.get(agent.id) ?? 0) + 1);
        agent.setAction(task.label);
        const el = this.els.get(task.id)!;
        const undos: (() => void)[] = [];
        try {
          await agent.sleep((task.delay ?? 0) * 1000);
          const work = task.errand ?? runEffect;
          await work({
            el,
            task,
            agent,
            overlay: this.opts.overlay,
            rng: this.rng,
            speed: () => this.speed(),
            skipping: () => this.skipping,
            aborted: () => this.aborted,
            onTeardown: (undo) => {
              undos.push(undo);
              this.teardowns.add(undo);
            },
            holdScaffold: (release) => this.scaffolds.set(task.id, release),
          });
        } catch (err) {
          if (err instanceof Aborted) throw err;
          console.error("[swarm] effect failed", task.id, err);
          markBuilt(el);
        } finally {
          undos.forEach((undo) => this.teardowns.delete(undo));
        }
        agent.setTool("dart");
        this.status.set(task.id, "done");
        if (this.calledIn.has(agent.id)) {
          this.shiftEnd.set(agent.id, performance.now() + this.rng.int(...AFTER_JOB_MS));
        }
        this.onDone(task);
      }
    } catch (err) {
      if (!(err instanceof Aborted)) throw err;
    }
  }

  private distanceTo(task: Task, from: Point) {
    const el = this.els.get(task.id);
    if (!el) return Infinity;
    const r = rectOf(el);
    return distance(from, { x: r.x, y: r.y });
  }

  /** Waits for work, drifting in the margins. Resolves true if the agent left. */
  private async idle(agent: AgentRuntime): Promise<boolean> {
    if (this.skipping && this.phase === "intro") {
      // Others may still be finishing; check back right away.
      await new Promise((r) => setTimeout(r, 16));
      return false;
    }
    const until = this.shiftEnd.get(agent.id) ?? performance.now() + this.rng.int(...SHIFT_MS);
    this.shiftEnd.set(agent.id, until);
    if (this.phase === "settled" && !document.hidden) {
      const crewFull = this.working().length >= this.maxCrew;
      const makeRoom = crewFull && missingOwners(this.state()).length > 0;
      if (makeRoom || performance.now() >= until) {
        // The last hands wait for a replacement to walk in.
        const { min } = restingCrew(this.maxCrew);
        if (!makeRoom && this.working().length <= min) this.bringFreshHands(1);
        return this.leave(agent);
      }
    }
    agent.setAction(this.rng.pick(IDLE_ACTIONS), true);
    const woken = new Promise<void>((resolve) => this.waiters.add(resolve));
    const token = (this.idleToken.get(agent.id) ?? 0) + 1;
    this.idleToken.set(agent.id, token);
    const wander = async () => {
      await agent.sleep(this.rng.int(300, 1400));
      if (this.idleToken.get(agent.id) !== token) return;
      await agent.moveTo(this.idlePoint(), { speed: 0.45 });
    };
    wander().catch(() => {});
    const shiftLeft = Math.max(until - performance.now(), 200);
    const linger =
      this.phase === "settled"
        ? Math.min(this.rng.int(5000, 11000), shiftLeft)
        : this.rng.int(2500, 5000);
    await Promise.race([woken, new Promise((r) => setTimeout(r, linger))]);
    return false;
  }

  /**
   * A spare hand heads off the nearest side of the screen and leaves the crew.
   * Resolves false if they were recalled on the way out.
   */
  private async leave(agent: AgentRuntime) {
    this.idleToken.set(agent.id, (this.idleToken.get(agent.id) ?? 0) + 1);
    this.leaving.add(agent);
    agent.setAction("leaving", true);
    const here = agent.pos();
    const toRight = here.x - window.scrollX > window.innerWidth / 2;
    await agent.moveTo(
      { x: window.scrollX + (toRight ? window.innerWidth + 60 : -60), y: here.y },
      { speed: 0.6 },
    );
    if (!this.leaving.has(agent)) return false;
    agent.stop();
    this.leaving.delete(agent);
    this.crew = this.crew.filter((a) => a !== agent);
    this.shiftEnd.delete(agent.id);
    this.calledIn.delete(agent.id);
    this.lastSeen.set(agent.id, performance.now());
    this.opts.onCrew([...this.crew]);
    // Their spot may be what someone else was waiting for.
    this.callIn();
    return true;
  }

  /** Someone needs an agent who is on their way out: they turn back. */
  private recall(agent: AgentRuntime) {
    this.leaving.delete(agent);
    this.calledIn.add(agent.id);
    agent.stop();
  }

  /** While things are quiet, fresh hands wander in now and then. */
  private scheduleArrival() {
    window.clearTimeout(this.arrivalTimer);
    this.arrivalTimer = window.setTimeout(
      () => {
        const { min, max } = restingCrew(this.maxCrew);
        const short = this.rng.int(min, max) - this.working().length;
        if (!document.hidden && backlog(this.state()) === 0 && short > 0) this.bringFreshHands(1);
        this.scheduleArrival();
      },
      this.rng.int(...ARRIVAL_MS),
    );
  }

  /** Somewhere in the margins of what the visitor is looking at. */
  private idlePoint(): Point {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = this.rng.next() < 0.5;
    const fx = left ? 0.008 + this.rng.next() * 0.03 : 0.955 + this.rng.next() * 0.03;
    return {
      x: window.scrollX + vw * fx,
      y: window.scrollY + vh * (0.25 + this.rng.next() * 0.6),
    };
  }

  private wake() {
    const ws = [...this.waiters];
    this.waiters.clear();
    ws.forEach((w) => w());
  }

  /* --------------------------------------------------------- progress */

  private onDone(task: Task) {
    // Clear scaffolding once everything inside it is built.
    for (const [frameId, release] of this.scaffolds) {
      const frame = this.els.get(frameId)!;
      const inside = this.tasks.filter(
        (t) => t.id !== frameId && frame.contains(this.els.get(t.id) ?? null),
      );
      if (inside.every((t) => this.status.get(t.id) === "done")) {
        release();
        this.scaffolds.delete(frameId);
      }
    }

    this.callIn();
    const state = this.state();
    if (
      task.section === HERO_SECTION &&
      this.phase === "intro" &&
      sectionDone(HERO_SECTION, state)
    ) {
      this.skipping = false;
      this.setPhase("settled");
    }
    if (sectionDone(task.section, state)) {
      window.dispatchEvent(new CustomEvent(SECTION_BUILT_EVENT, { detail: task.section }));
    }
    this.wake();
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.opts.onPhase(phase);
    if (phase === "settled") this.scheduleArrival();
  }

  /* --------------------------------------------------------- sections */

  private observeSections() {
    this.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = (entry.target as HTMLElement).dataset.buildSection;
          if (section) this.activate(section);
          this.io?.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    document
      .querySelectorAll<HTMLElement>("[data-build-section]")
      .forEach((el) => el.dataset.buildSection !== HERO_SECTION && this.io!.observe(el));
  }

  private onScroll = () => {
    const atBottom =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
    if (!atBottom) return;
    document.querySelectorAll<HTMLElement>("[data-build-section]").forEach((el) => {
      const section = el.dataset.buildSection;
      if (section && el.getBoundingClientRect().top < window.innerHeight) this.activate(section);
    });
  };

  private activate(section: string) {
    if (this.active.has(section)) return;
    this.active.add(section);
    this.completePasses(section);
    if (section !== HERO_SECTION) this.grow();
    this.wake();
  }

  private completePasses(section: string) {
    for (const t of this.tasks) {
      if (t.section === section && t.kind === "pass" && !this.status.has(t.id)) {
        markBuilt(this.els.get(t.id)!);
        this.status.set(t.id, "done");
      }
    }
  }
}
