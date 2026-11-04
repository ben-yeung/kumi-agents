"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { HandsBoard } from "@/components/sections/HandsBoard";
import { LaneRule } from "@/components/sections/LaneRule";
import { workOnBoard, workOnNote, type VisitActions } from "@/components/sections/handsWork";
import {
  CREW_ERRAND_EVENT,
  SECTION_BUILT_EVENT,
  SWARM_REPLAY_EVENT,
  build,
} from "@/components/swarm/build";
import type { Errand } from "@/components/swarm/types";
import { agent, type AgentId } from "@/lib/agents";
import {
  INITIAL_WORK,
  LANES,
  finishStep,
  heldCard,
  isFinished,
  pickLane,
  planVisit,
  setProgress,
  settleVisit,
  startCard,
  type Lane,
  type Visit,
  type Work,
} from "@/lib/lanes";
import { createRng, randomSeed } from "@/lib/rng";
import layout from "@/components/ui/layout.module.css";
import sketch from "@/components/ui/SketchBox.module.css";
import styles from "./ManyHands.module.css";

type View = "notes" | "board";

const SECTION = "hands";
const FIRST_VISIT_MS: [number, number] = [1200, 2600];
const VISIT_MS: [number, number] = [2500, 5000];
/** Agents working on their own notes at the same moment. */
const MAX_VISITS = 2;
/** The foot of a column fades out; cards under it are not worked on. */
const COLUMN_FADE = 56;

/**
 * The agents' work, as eight notes or as a board. Once the crew has built the
 * section, agents keep coming back to move their own work along while it is
 * on screen. The notes stay mounted under the board so they stay built.
 */
export function LiveHands() {
  const [work, setWork] = useState<Work>(INITIAL_WORK);
  const [view, setView] = useState<View>("notes");
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View>("notes");
  const workRef = useRef<Work>(INITIAL_WORK);

  function flip(next: View) {
    viewRef.current = next;
    setView(next);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rng = createRng(randomSeed());
    const lastVisit = new Map<AgentId, number>();
    let started = false;
    let inView = false;
    const visiting = new Set<AgentId>();
    let run = 0;
    let timer = 0;

    const update = (change: (w: Work) => Work, now = false) => {
      workRef.current = change(workRef.current);
      const next = workRef.current;
      if (now) flushSync(() => setWork(next));
      else setWork(next);
    };

    const schedule = ([min, max]: [number, number]) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(visit, rng.int(min, max));
    };

    /** Agents whose work can actually be seen right now. */
    const visibleAgents = () => {
      const fits = (el: Element, within?: DOMRect) => {
        const r = el.getBoundingClientRect();
        const top = Math.max(0, within?.top ?? 0);
        const bottom = Math.min(window.innerHeight, within?.bottom ?? Infinity);
        return r.height > 0 && r.top >= top && r.bottom <= bottom;
      };
      if (viewRef.current === "notes") {
        return LANES.map((l) => l.agent).filter((id) => {
          const note = root.querySelector(`[data-lane="${id}"]`);
          return note && fits(note);
        });
      }
      const list = root.querySelector('[data-column="doing"] ol')?.getBoundingClientRect();
      const clear = list && new DOMRect(list.x, list.y, list.width, list.height - COLUMN_FADE);
      const held = root.querySelectorAll<HTMLElement>('[data-status="doing"]');
      return [...held].filter((c) => fits(c, clear)).map((c) => c.dataset.agent as AgentId);
    };

    function visit() {
      if (workRef.current.lanes.every(isFinished)) return;
      if (visiting.size >= MAX_VISITS || !inView || document.hidden) return schedule(VISIT_MS);
      const free = visibleAgents().filter((id) => !visiting.has(id));
      const lane = pickLane(workRef.current.lanes, free, lastVisit);
      if (!lane) return schedule(VISIT_MS);
      const plan = planVisit(lane, rng);
      if (!plan) return schedule(VISIT_MS);
      visiting.add(lane.agent);
      lastVisit.set(lane.agent, performance.now());
      schedule(VISIT_MS);
      window.dispatchEvent(
        new CustomEvent<Errand>(CREW_ERRAND_EVENT, {
          detail: {
            agent: lane.agent,
            label: "updating progress",
            section: SECTION,
            el: root!,
            run: (ctx) => carryOut(ctx, lane, plan),
          },
        }),
      );
    }

    async function carryOut(ctx: Parameters<Errand["run"]>[0], lane: Lane, plan: Visit) {
      const thisRun = run;
      const seen = viewRef.current;
      const live = () => thisRun === run && viewRef.current === seen;
      const actions: VisitActions = {
        alive: live,
        progress: (value) => live() && update((w) => setProgress(w, plan.agent, value)),
        finishStep: (hold) =>
          live() && update((w) => finishStep(w, plan.agent, plan.tick!, hold), true),
        startNext: () => {
          const id = heldCard(workRef.current, plan.agent);
          if (id && live()) update((w) => startCard(w, id), true);
        },
        nextCard: () => heldCard(workRef.current, plan.agent),
      };
      const held = root!.querySelector<HTMLElement>(
        `[data-status="doing"][data-agent="${plan.agent}"]`,
      );
      const note = root!.querySelector<HTMLElement>(`[data-lane="${plan.agent}"]`);
      try {
        if (seen === "board" && held) await workOnBoard(ctx, root!, held, plan, actions);
        else if (seen === "notes" && note) await workOnNote(ctx, note, plan, actions);
      } finally {
        // Replays start from scratch; otherwise the visit always lands.
        if (thisRun === run) {
          update((w) => settleVisit(w, plan));
          visiting.delete(plan.agent);
        }
      }
    }

    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
    });
    io.observe(root);

    const onBuilt = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== SECTION || started) return;
      started = true;
      schedule(FIRST_VISIT_MS);
    };
    window.addEventListener(SECTION_BUILT_EVENT, onBuilt);

    const onReplay = () => {
      window.clearTimeout(timer);
      run++;
      started = false;
      visiting.clear();
      lastVisit.clear();
      workRef.current = INITIAL_WORK;
      viewRef.current = "notes";
      setWork(INITIAL_WORK);
      setView("notes");
    };
    window.addEventListener(SWARM_REPLAY_EVENT, onReplay);

    return () => {
      window.removeEventListener(SWARM_REPLAY_EVENT, onReplay);
      window.removeEventListener(SECTION_BUILT_EVENT, onBuilt);
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.live}>
      <div
        className={styles.viewToggle}
        role="group"
        aria-label="How to view the work"
        {...build("reveal", "adding a switch", {
          id: "hands.view",
          after: LANES.map((l) => `rule.${l.agent}`),
        })}
      >
        <ViewButton view="notes" current={view} intent="reading notes" onPick={flip} />
        <ViewButton view="board" current={view} intent="scanning board" onPick={flip} />
      </div>
      <ol className={styles.lanes} hidden={view !== "notes"}>
        {work.lanes.map((lane) => (
          <Note key={lane.agent} lane={lane} />
        ))}
      </ol>
      {view === "board" && <HandsBoard work={work} />}
    </div>
  );
}

function ViewButton({
  view,
  current,
  intent,
  onPick,
}: {
  view: View;
  current: View;
  intent: string;
  onPick: (view: View) => void;
}) {
  return (
    <button
      type="button"
      className={styles.viewButton}
      aria-pressed={current === view}
      data-intent={intent}
      onClick={() => onPick(view)}
    >
      <span>{view}</span>
    </button>
  );
}

function Note({ lane }: { lane: Lane }) {
  const a = agent(lane.agent);
  return (
    <li
      className={`${sketch.box} ${styles.lane}`}
      style={{ "--a": a.color } as React.CSSProperties}
      data-lane={a.id}
      data-intent={lane.intent}
      {...build("box", "drawing lane", { agent: a.id })}
    >
      <div className={styles.laneHead} {...build("reveal", "naming lane")}>
        <span className={layout.dot} />
        <span className={styles.laneName}>{a.name}</span>
        <span className={styles.lanePct}>{Math.round(lane.progress * 100)}%</span>
      </div>
      <h3 className={styles.piece} {...build("type", "naming piece")}>
        {lane.piece}
      </h3>
      <ul className={styles.steps} {...build("list", "listing steps")}>
        {lane.steps.map((s) => (
          <li key={s.text} className={styles.step} data-step="" data-done={s.done}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {s.done ? (
                <path d="M3.2 8.6c1.3 1 2.3 2 3.2 3.1 2-3 4-5.3 6.6-7.6" />
              ) : (
                <circle cx="8" cy="8" r="2.4" />
              )}
            </svg>
            <span>{s.text}</span>
            <span className="visually-hidden">{s.done ? "(done)" : "(in progress)"}</span>
          </li>
        ))}
      </ul>
      <LaneRule
        progress={lane.progress}
        {...build("stroke", "marking progress", { id: `rule.${a.id}` })}
      />
    </li>
  );
}
