"use client";

import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./CursorTag.module.css";

type Props = {
  name: string;
  /** Shown after the name when present (tag mode "actions"). */
  action?: string | null;
  flipX?: boolean;
  flipY?: boolean;
  reduceMotion?: boolean;
};

const TYPE_MS = 34;
const ERASE_MS = 18;
const FLIP_MS = 560;

/**
 * Types toward `target`: erases back to the longest shared prefix, then
 * types the rest one character at a time. Null means "say nothing".
 */
function useTypewriter(target: string | null | undefined, instant: boolean) {
  const goal = target ?? "";
  const [shown, setShown] = useState(goal);
  const shownRef = useRef(goal);

  useEffect(() => {
    let timer = 0;
    const step = () => {
      const current = shownRef.current;
      if (current === goal) return;
      let next: string;
      if (instant) next = goal;
      else if (goal.startsWith(current)) next = goal.slice(0, current.length + 1);
      else next = current.slice(0, -1);
      shownRef.current = next;
      setShown(next);
      if (next !== goal) {
        timer = window.setTimeout(step, goal.startsWith(next) ? TYPE_MS : ERASE_MS);
      }
    };
    timer = window.setTimeout(step, 0);
    return () => window.clearTimeout(timer);
  }, [goal, instant]);

  return shown;
}

/**
 * The small pill that rides next to a cursor: `name · action`. The action
 * types itself in and out, the pill's width eases to fit, and flipping
 * sides is a slide rather than a jump.
 */
export const CursorTag = forwardRef<HTMLDivElement, Props>(function CursorTag(
  { name, action, flipX = false, flipY = false, reduceMotion = false },
  ref,
) {
  const shown = useTypewriter(action, reduceMotion);
  const innerRef = useRef<HTMLSpanElement>(null);
  const tagRef = useRef<HTMLDivElement | null>(null);

  // Size the pill to its content on every typed character, before paint, so
  // the width moves in step with the text rather than trailing it.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const tag = tagRef.current;
    if (inner && tag) tag.style.setProperty("--w", `${inner.offsetWidth}px`);
  }, [shown, name]);

  const setRefs = (el: HTMLDivElement | null) => {
    tagRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  // Animate the slide only while flipping, so width changes never drag the
  // tag away from the pointer.
  const [prevFlip, setPrevFlip] = useState(`${flipX}${flipY}`);
  const [flipping, setFlipping] = useState(false);
  if (prevFlip !== `${flipX}${flipY}`) {
    setPrevFlip(`${flipX}${flipY}`);
    setFlipping(true);
  }
  useEffect(() => {
    if (!flipping) return;
    const t = window.setTimeout(() => setFlipping(false), FLIP_MS);
    return () => window.clearTimeout(t);
  }, [flipping]);

  return (
    <div
      ref={setRefs}
      className={styles.tag}
      data-flip-x={flipX}
      data-flip-y={flipY}
      data-flipping={flipping && !reduceMotion}
      data-animate={!reduceMotion}
    >
      <span ref={innerRef} className={styles.inner}>
        <span className={styles.name}>{name}</span>
        {shown && (
          <>
            <span className={styles.sep} aria-hidden="true">
              ·
            </span>
            <span className={styles.action}>{shown}</span>
          </>
        )}
      </span>
    </div>
  );
});
