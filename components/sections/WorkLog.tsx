import { WORKLOG } from "@/lib/worklog";
import { WORKLOG_LIST_ID, build, buildSection } from "@/components/swarm/build";
import { LogEntryRow } from "@/components/sections/LogEntryRow";
import { LiveLog } from "@/components/sections/LiveLog";
import layout from "@/components/ui/layout.module.css";
import styles from "./WorkLog.module.css";

export function WorkLog() {
  return (
    <section
      id="log"
      className={styles.section}
      aria-labelledby="log-title"
      {...buildSection("log")}
    >
      <div className={`${layout.container} ${styles.layout}`}>
        <header className={styles.intro}>
          <p className={layout.kicker} {...build("reveal", "labeling")}>
            work log
          </p>
          <h2
            id="log-title"
            className={layout.sectionTitle}
            data-intent="listening in"
            {...build("type", "titling")}
          >
            The quiet hum <em>of a workshop.</em>
          </h2>
          <div
            className={layout.prose}
            data-intent="leaning in"
            {...build("develop", "setting text")}
          >
            <p>Need to step away for a moment?</p>
            <p>Agents continuously log their work with notes,</p>
            <p>allowing you to review work on your own schedule.</p>
          </div>
        </header>

        <ol id={WORKLOG_LIST_ID} className={styles.log} aria-label="Recent activity">
          {WORKLOG.map((e) => (
            <LogEntryRow key={e.id} entry={e} />
          ))}
          <LiveLog />
        </ol>
      </div>
    </section>
  );
}
