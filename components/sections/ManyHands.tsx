import { LiveHands } from "@/components/sections/LiveHands";
import { build, buildSection } from "@/components/swarm/build";
import layout from "@/components/ui/layout.module.css";
import styles from "./ManyHands.module.css";

export function ManyHands() {
  return (
    <section
      id="hands"
      className={styles.section}
      aria-labelledby="hands-title"
      {...buildSection("hands")}
    >
      <div className={`${layout.container} ${styles.layout}`}>
        <header className={styles.intro}>
          <p className={layout.kicker} {...build("reveal", "labeling")}>
            many hands
          </p>
          <h2
            id="hands-title"
            className={layout.sectionTitle}
            data-intent="counting hands"
            {...build("type", "titling")}
          >
            A team of agents, <em>one afternoon.</em>
          </h2>
          <div
            className={`${layout.prose} ${styles.description}`}
            data-intent="nodding along"
            {...build("develop", "setting text")}
          >
            <p>Give Kumi a goal and every agent takes a piece.</p>
            <p>Watch the work happen instead of staring at a loading spinner.</p>
          </div>
        </header>

        <LiveHands />
      </div>
    </section>
  );
}
