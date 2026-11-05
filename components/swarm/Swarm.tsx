"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TagModeToggle } from "@/components/prefs/Controls";
import { useMediaQuery } from "@/components/prefs/useMediaQuery";
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
  // No crew under reduced motion, but the visitor's own tag still has a setting.
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const finePointer = useMediaQuery("(pointer: fine)");
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
      {reduceMotion && finePointer && (
        <div className={styles.controls}>
          <TagModeToggle className={styles.controlButton} />
        </div>
      )}
      {phase && (
        <>
          <CrewCount crew={crew} />
          <SwarmControls phase={phase} onSkip={() => engineRef.current?.skip()} onReplay={replay} />
        </>
      )}
    </>
  );
}

function AgentCursor({ runtime }: { runtime: AgentRuntime }) {
  const snap = useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot);
  const [tagMode] = useTagMode();
  return (
    <motion.div
      className={styles.agent}
      style={{ x: runtime.x, y: runtime.y, "--c": runtime.agent.color } as never}
      data-swarm-agent=""
      data-pressed={snap.pressed}
    >
      <div className={styles.press}>
        <Pointer key={snap.tool} variant={snap.tool} />
      </div>
      <CursorTag
        name={runtime.agent.name}
        action={tagMode === "actions" ? snap.action : null}
        flipX={snap.flipX}
      />
    </motion.div>
  );
}

/** Who is on the crew right now; hover, focus or tap to see what they are up to. */
function CrewCount({ crew }: { crew: AgentRuntime[] }) {
  const [open, setOpen] = useState(false);
  // A mouse has already opened the menu by hovering; its click must not close it.
  const hovering = useRef(false);
  return (
    <div
      className={styles.crewAnchor}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = true;
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = false;
        setOpen(false);
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.crewMenu}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
          >
            <ul id="crew-menu" aria-label="Agents at work" className={styles.crewList}>
              {crew.map((a) => (
                <CrewMember key={a.id} runtime={a} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        className={styles.crew}
        data-swarm-crew
        data-intent="counting heads"
        aria-expanded={open}
        aria-controls="crew-menu"
        onClick={() => !hovering.current && setOpen((o) => !o)}
        onFocus={(e) => e.target.matches(":focus-visible") && setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span className={styles.crewDots} aria-hidden="true">
          {crew.map((a) => (
            <span key={a.id} style={{ "--c": a.agent.color } as React.CSSProperties} />
          ))}
        </span>
        <span>
          {crew.length} {crew.length === 1 ? "hand" : "hands"}
        </span>
      </button>
    </div>
  );
}

function CrewMember({ runtime }: { runtime: AgentRuntime }) {
  const { action } = useSyncExternalStore(runtime.subscribe, runtime.snapshot, runtime.snapshot);
  return (
    <li
      className={styles.crewMember}
      style={{ "--c": runtime.agent.color } as React.CSSProperties}
      data-intent={runtime.agent.greeting}
    >
      <span className={styles.crewDot} aria-hidden="true" />
      <span className={styles.crewName}>{runtime.agent.name}</span>
      <span className={styles.crewAction}>{action ?? "on the way"}</span>
    </li>
  );
}

function SwarmControls({
  phase,
  onSkip,
  onReplay,
}: {
  phase: Phase;
  onSkip: () => void;
  onReplay: () => void;
}) {
  return (
    <div className={styles.controls} data-swarm-controls>
      <TagModeToggle className={styles.controlButton} />
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
          data-intent={phase === "intro" ? "impatient" : "wanting more"}
          data-intent-press={phase === "intro" ? "skipping" : "encore!"}
        >
          <span>{phase === "intro" ? "skip intro" : "replay"}</span>
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
