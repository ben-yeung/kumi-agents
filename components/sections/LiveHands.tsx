"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { HandsBoard } from "@/components/sections/HandsBoard";
import { LaneRule } from "@/components/sections/LaneRule";
import {
  addToBoard,
  addToNote,
  workOnBoard,
  workOnNote,
  type AddActions,
  type VisitActions,
} from "@/components/sections/handsWork";
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
  hasWork,
  heldCard,
  isFinished,
  nextToWrite,
  openPiece,
  pickLane,
  planCardVisit,
  planVisit,
  setProgress,
  settleOpening,
  settleVisit,
  startCard,
  writeStep,
  type Lane,
  type Work,
} from "@/lib/lanes";
import { createRng, randomSeed } from "@/lib/rng";
import layout from "@/components/ui/layout.module.css";
import sketch from "@/components/ui/SketchBox.module.css";
import styles from "./ManyHands.module.css";

type View = "notes" | "board";

const SECTION = "hands";
const FIRST_VISIT_MS: [number, number] = [1200, 2600];
const VISIT_MS: [number, number] = [4000, 8000];
/** Agents working on their own notes at the same moment. */
const MAX_VISITS = 2;
/** The foot of a column fades out; cards under it are not worked on. */
const COLUMN_FADE = 56;
/** Room an agent needs at the top of Planned to add new cards. */
const PLANNED_ROOM = 120;

/**
 * The agents' work, as eight notes or as a board. Once the crew has built the
 * section, agents keep coming back to move their own work along while it is
 * on screen, adding new tasks as they finish. The notes stay mounted under the
 * board so they stay built.
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
      const working = [...held]
        .filter((c) => fits(c, clear))
        .map((c) => c.dataset.agent as AgentId);
      // Agents between pieces hold no card; they write theirs at the top of Planned.
      const planned = root.querySelector('[data-column="planned"] ol')?.getBoundingClientRect();
      const roomy = planned && planned.top >= 0 && planned.top + PLANNED_ROOM <= innerHeight;
      const between = workRef.current.lanes.filter(isFinished).map((l) => l.agent);
      return roomy ? [...working, ...between] : working;
    };

    function visit() {
      if (!workRef.current.lanes.some(hasWork)) return;
      if (visiting.size >= MAX_VISITS || !inView || document.hidden) return schedule(VISIT_MS);
      const free = visibleAgents().filter((id) => !visiting.has(id));
      const lane = pickLane(workRef.current.lanes, free, lastVisit);
      if (!lane) return schedule(VISIT_MS);
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
            run: (ctx) => carryOut(ctx, lane.agent),
          },
        }),
      );
    }

    /**
     * Errands wait their turn, so what a visit does is decided here, when the
     * agent gets to it, from the view and work as they stand by then.
     */
    async function carryOut(ctx: Parameters<Errand["run"]>[0], id: AgentId) {
      const thisRun = run;
      const seen = viewRef.current;
      const live = () => thisRun === run && viewRef.current === seen;
      const lane = workRef.current.lanes.find((l) => l.agent === id)!;
      const plan = seen === "board" ? planCardVisit(lane) : planVisit(lane, rng);
      const pickUp = {
        alive: live,
        startNext: () => {
          const card = heldCard(workRef.current, id);
          if (card && live()) update((w) => startCard(w, card), true);
        },
        nextCard: () => heldCard(workRef.current, id),
      };
      const note = root!.querySelector<HTMLElement>(`[data-lane="${id}"]`);
      try {
        if (!plan) {
          const actions: AddActions = {
            ...pickUp,
            open: () => live() && update((w) => openPiece(w, id), true),
            write: () => {
              const now = workRef.current.lanes.find((l) => l.agent === id)!;
              const card = nextToWrite(now);
              if (card && live()) update((w) => writeStep(w, id), true);
              return card;
            },
          };
          if (seen === "board") await addToBoard(ctx, root!, actions);
          else if (seen === "notes" && note) await addToNote(ctx, note, actions);
          return;
        }
        const actions: VisitActions = {
          ...pickUp,
          progress: (value) => live() && update((w) => setProgress(w, id, value)),
          finishStep: (hold) => live() && update((w) => finishStep(w, id, plan.tick!, hold), true),
        };
        const held = root!.querySelector<HTMLElement>(`[data-status="doing"][data-agent="${id}"]`);
        if (seen === "board" && held) await workOnBoard(ctx, root!, held, plan, actions);
        else if (seen === "notes" && note) await workOnNote(ctx, note, plan, actions);
      } finally {
        // Replays start from scratch; otherwise the visit always lands.
        if (thisRun === run) {
          update((w) => (plan ? settleVisit(w, plan) : settleOpening(w, id)));
          visiting.delete(id);
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
        {lane.steps.map((s, i) => (
          <li
            key={s.text}
            className={styles.step}
            data-step=""
            data-done={s.done}
            data-unwritten={i >= lane.written || undefined}
          >
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
