import type { Ref } from "react";
import { agent } from "@/lib/agents";
import type { LogEntry } from "@/lib/worklog";
import { build } from "@/components/swarm/build";
import layout from "@/components/ui/layout.module.css";
import styles from "./WorkLog.module.css";

/** One line of the work log, written by its agent. Shared by server and live rows. */
export function LogEntryRow({ entry, ref }: { entry: LogEntry; ref?: Ref<HTMLLIElement> }) {
  const a = agent(entry.agent);
  return (
    <li
      ref={ref}
      className={styles.entry}
      style={{ "--a": a.color } as React.CSSProperties}
      data-intent={`reading ${a.name}`}
      {...build("type", "logging", { agent: a.id, pace: 1.6 })}
    >
      <time className={styles.time}>{entry.time}</time>
      <span className={styles.who}>
        <span className={layout.dot} />
        {a.name}
      </span>
      <span className={styles.text}>{entry.text}</span>
    </li>
  );
}
