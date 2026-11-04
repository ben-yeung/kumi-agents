"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/components/prefs/useMediaQuery";
import { useTagMode } from "@/components/prefs/usePrefs";
import { useVisitorIdentity } from "@/components/visitor/useVisitorIdentity";
import { CursorTag } from "@/components/ui/CursorTag";
import { Pointer } from "@/components/ui/Pointer";
import {
  IDLE_INTENT,
  SCROLL_INTENT,
  SELECT_INTENT,
  WANDER_INTENT,
  isClickable,
  resolveIntent,
  visitorColor,
} from "@/lib/visitor";
import styles from "./VisitorCursor.module.css";

const IDLE_AFTER_MS = 6000;
const SCROLL_SETTLE_MS = 700;

/**
 * The visitor's own cursor: a solid pointer in their own color, tagged
 * "you" and, in "actions" mode, with what they are doing based on what is
 * under the pointer.
 */
export function VisitorCursor() {
  const finePointer = useMediaQuery("(pointer: fine)");
  const identity = useVisitorIdentity();
  if (!finePointer || !identity) return null;
  return <Cursor color={visitorColor(identity.hue)} />;
}

function Cursor({ color }: { color: string }) {
  const [tagMode] = useTagMode();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [intent, setIntent] = useState(WANDER_INTENT);
  const [overClickable, setOverClickable] = useState(false);
  const [flip, setFlip] = useState({ x: false, y: false });
  const tagRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const spring = reduceMotion
    ? { stiffness: 10000, damping: 1000 }
    : { stiffness: 520, damping: 42, mass: 0.6 };
  const tagX = useSpring(x, spring);
  const tagY = useSpring(y, spring);

  const last = useRef({ x: -100, y: -100, target: null as Element | null, pressed: false });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-visitor-cursor", "on");
    root.style.setProperty("--visitor-color", color);

    let idleTimer = 0;
    let scrollTimer = 0;
    let scrolling = false;

    function settle() {
      const s = last.current;
      setOverClickable(isClickable(s.target));
      if (scrolling) return;
      const selection = window.getSelection();
      if (s.pressed && selection && !selection.isCollapsed) {
        setIntent(SELECT_INTENT);
        return;
      }
      setIntent(resolveIntent(s.target, s.pressed) ?? WANDER_INTENT);
    }

    function armIdle() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (!last.current.pressed) setIntent(IDLE_INTENT);
      }, IDLE_AFTER_MS);
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      x.set(e.clientX);
      y.set(e.clientY);
      last.current.x = e.clientX;
      last.current.y = e.clientY;
      last.current.target = e.target as Element;
      setVisible(true);
      const tag = tagRef.current;
      if (tag) {
        const margin = 24;
        const fx = e.clientX + tag.offsetWidth + margin > window.innerWidth;
        const fy = e.clientY + tag.offsetHeight + margin + 20 > window.innerHeight;
        setFlip((prev) => (prev.x === fx && prev.y === fy ? prev : { x: fx, y: fy }));
      }
      settle();
      armIdle();
    }

    function onDown(e: PointerEvent) {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      last.current.pressed = true;
      setPressed(true);
      settle();
    }

    function onUp() {
      last.current.pressed = false;
      setPressed(false);
      settle();
    }

    function onScroll() {
      scrolling = true;
      setIntent(SCROLL_INTENT);
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        scrolling = false;
        const { x: px, y: py } = last.current;
        last.current.target = document.elementFromPoint(px, py);
        settle();
        armIdle();
      }, SCROLL_SETTLE_MS);
    }

    function onLeave(e: MouseEvent) {
      if (!e.relatedTarget) setVisible(false);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseout", onLeave);
    document.addEventListener("selectionchange", settle);

    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(scrollTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onLeave);
      document.removeEventListener("selectionchange", settle);
      root.removeAttribute("data-visitor-cursor");
      root.style.removeProperty("--visitor-color");
    };
  }, [color, x, y]);

  return (
    <div
      className={styles.layer}
      aria-hidden="true"
      data-visible={visible}
      style={{ "--c": color } as React.CSSProperties}
    >
      <motion.div
        className={styles.tip}
        style={{ x, y }}
        data-pressed={pressed}
        data-clickable={overClickable}
      >
        <Pointer />
        <Pointer variant="hand" />
      </motion.div>

      <motion.div className={styles.tagAnchor} style={{ x: tagX, y: tagY }}>
        <CursorTag
          ref={tagRef}
          name="you"
          action={tagMode === "actions" ? intent : null}
          flipX={flip.x}
          flipY={flip.y}
          reduceMotion={reduceMotion}
        />
      </motion.div>
    </div>
  );
}
