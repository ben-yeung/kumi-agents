"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTagMode } from "@/components/prefs/usePrefs";
import { CursorTag } from "@/components/ui/CursorTag";
import { Pointer } from "@/components/ui/Pointer";
import type { AgentRuntime } from "@/components/swarm/agent";
import { SWARM_REPLAY_EVENT } from "@/components/swarm/build";
import { SwarmEngine, type Handoff, type Phase } from "@/components/swarm/engine";
import styles from "./Swarm.module.css";

/**
 * Mounts the crew. Renders nothing for visitors who prefer reduced motion:
 * the page is then simply shown finished.
 */
export function Swarm() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SwarmEngine | null>(null);
  const [crew, setCrew] = useState<AgentRuntime[]>([]);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [run, setRun] = useState(0);
  const handoffRef = useRef<Handoff | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.removeAttribute("data-swarm");
      return;
    }
    const engine = new SwarmEngine({
      overlay,
      onCrew: setCrew,
      onPhase: setPhase,
      handoff: handoffRef.current,
    });
    handoffRef.current = null;
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
      setCrew([]);
      setPhase(null);
    };
  }, [run]);

  /** Replays the whole page: everything unbuilds and the crew starts over. */
  function replay() {
    const engine = engineRef.current;
    if (!engine) return;
    handoffRef.current = engine.handoff();
    window.dispatchEvent(new Event(SWARM_REPLAY_EVENT));
    window.scrollTo({ top: 0, behavior: "instant" });
    setRun((r) => r + 1);
  }

  return (
    <>
      <div ref={overlayRef} className={styles.overlay} aria-hidden="true">
        {crew.map((a) => (
          <AgentCursor key={a.id} runtime={a} />
        ))}
      </div>
      {phase && (
        <SwarmControls
          phase={phase}
          crew={crew}
          onSkip={() => engineRef.current?.skip()}
          onReplay={replay}
        />
      )}
    </>
  );
}

const IDLE_TAG_QUIET_MS = 2400;

function AgentCursor({ runtime }: { runtime: AgentRuntime }) {
  const snap = useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot);
  const [tagMode] = useTagMode();
  // Idle agents say what they are up to briefly, then fall quiet to just a name.
  const [quietFor, setQuietFor] = useState<string | null>(null);
  useEffect(() => {
    if (!snap.idle) return;
    const t = window.setTimeout(() => setQuietFor(snap.action), IDLE_TAG_QUIET_MS);
    return () => window.clearTimeout(t);
  }, [snap.idle, snap.action]);
  const quiet = snap.idle && quietFor === snap.action;
  return (
    <motion.div
      className={styles.agent}
      style={{ x: runtime.x, y: runtime.y, "--c": runtime.agent.color } as never}
      data-idle={snap.idle}
      data-pressed={snap.pressed}
    >
      <div className={styles.press}>
        <Pointer key={snap.tool} variant={snap.tool} />
      </div>
      <CursorTag
        name={runtime.agent.name}
        action={tagMode === "actions" && !quiet ? snap.action : null}
        flipX={snap.flipX}
      />
    </motion.div>
  );
}

function SwarmControls({
  phase,
  crew,
  onSkip,
  onReplay,
}: {
  phase: Phase;
  crew: AgentRuntime[];
  onSkip: () => void;
  onReplay: () => void;
}) {
  return (
    <div className={styles.controls} data-swarm-controls>
      <span className={styles.crewDots} aria-hidden="true">
        {crew.map((a) => (
          <span key={a.id} style={{ "--c": a.agent.color } as React.CSSProperties} />
        ))}
      </span>
      <span>
        {crew.length} {crew.length === 1 ? "hand" : "hands"}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.button
          key={phase}
          type="button"
          className={styles.controlButton}
          onClick={phase === "intro" ? onSkip : onReplay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          data-intent={phase === "intro" ? "skipping?" : "encore?"}
          data-intent-press={phase === "intro" ? "skipping" : "encore"}
        >
          {phase === "intro" ? "skip intro" : "replay"}
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
