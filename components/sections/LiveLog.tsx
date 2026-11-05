"use client";

import { useEffect, useRef, useState } from "react";
import {
  BUILD_ADD_EVENT,
  SECTION_BUILT_EVENT,
  SWARM_REPLAY_EVENT,
  WORKLOG_LIST_ID,
} from "@/components/swarm/build";
import { LogEntryRow } from "@/components/sections/LogEntryRow";
import { createRng, randomSeed } from "@/lib/rng";
import { LIVE_NOTES, WORKLOG, nextLogEntry, type LogEntry } from "@/lib/worklog";

/**
 * Keeps the work log growing: once the crew has written the seed entries,
 * a new note arrives every few seconds while the log is on screen.
 */
export function LiveLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    const list = document.getElementById(WORKLOG_LIST_ID);
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rng = createRng(randomSeed());
    let started = false;
    let inView = false;
    let timer = 0;
    let count = 0;
    let history: LogEntry[] = [...WORKLOG];

    const schedule = () => {
      window.clearTimeout(timer);
      if (count >= LIVE_NOTES.length) return;
      timer = window.setTimeout(add, rng.int(3200, 6500));
    };

    function add() {
      if (!inView || document.hidden) return schedule();
      const entry = nextLogEntry(rng, history);
      if (!entry) return;
      history.push(entry);
      count++;
      setEntries((prev) => [...prev, entry]);
      schedule();
    }

    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
    });
    io.observe(list);

    const onBuilt = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "log" || started) return;
      started = true;
      schedule();
    };
    window.addEventListener(SECTION_BUILT_EVENT, onBuilt);

    const onReplay = () => {
      window.clearTimeout(timer);
      started = false;
      count = 0;
      history = [...WORKLOG];
      setEntries([]);
    };
    window.addEventListener(SWARM_REPLAY_EVENT, onReplay);

    return () => {
      window.removeEventListener(SWARM_REPLAY_EVENT, onReplay);
      window.clearTimeout(timer);
      io.disconnect();
      window.removeEventListener(SECTION_BUILT_EVENT, onBuilt);
    };
  }, []);

  return (
    <>
      {entries.map((entry) => (
        <LiveRow key={entry.id} entry={entry} />
      ))}
    </>
  );
}

const OPEN_MS = 700;

/**
 * A new note: its row first eases open (so nothing below jumps), and only
 * then is it handed to the crew to be written in.
 */
function LiveRow({ entry }: { entry: LogEntry }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handOff = () => window.dispatchEvent(new CustomEvent(BUILD_ADD_EVENT, { detail: el }));
    const cs = getComputedStyle(el);
    const open = el.animate(
      [
        {
          height: "0px",
          paddingTop: "0px",
          paddingBottom: "0px",
          borderBottomColor: "transparent",
          overflow: "hidden",
        },
        {
          height: `${el.offsetHeight}px`,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          borderBottomColor: cs.borderBottomColor,
          overflow: "hidden",
        },
      ],
      { duration: OPEN_MS, easing: "cubic-bezier(0.33, 0, 0.2, 1)" },
    );
    open.onfinish = handOff;
    return () => {
      open.onfinish = null;
      open.cancel();
    };
  }, []);
  return <LogEntryRow ref={ref} entry={entry} />;
}
