import { agent, type AgentId } from "@/lib/agents";
import { build, buildSection } from "@/components/swarm/build";
import layout from "@/components/ui/layout.module.css";
import sketch from "@/components/ui/SketchBox.module.css";
import styles from "./ManyHands.module.css";

type Lane = {
  agent: AgentId;
  strand: string;
  steps: { text: string; done: boolean }[];
  progress: number;
};

const LANES: Lane[] = [
  {
    agent: "ren",
    strand: "Draft the data model",
    steps: [
      { text: "sketch entities", done: true },
      { text: "name the relations", done: true },
      { text: "write the schema", done: false },
    ],
    progress: 0.72,
  },
  {
    agent: "sol",
    strand: "Write the onboarding copy",
    steps: [
      { text: "read the brief", done: true },
      { text: "first pass, plain words", done: false },
      { text: "trim by a third", done: false },
    ],
    progress: 0.41,
  },
  {
    agent: "mika",
    strand: "Tighten the test suite",
    steps: [
      { text: "find the flaky ones", done: true },
      { text: "fix the clock", done: true },
      { text: "add edge cases", done: false },
    ],
    progress: 0.93,
  },
  {
    agent: "juno",
    strand: "Read the payments docs",
    steps: [
      { text: "skim the guides", done: true },
      { text: "note the webhooks", done: false },
      { text: "flag the gotchas", done: false },
    ],
    progress: 0.28,
  },
];

/** A hand-drawn thread whose length reflects progress. */
function Thread({ progress }: { progress: number }) {
  const end = 6 + progress * 188;
  return (
    <svg
      className={styles.thread}
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      {...build("stroke", "pulling thread")}
    >
      <path className={styles.threadBase} d="M6 6.5 C 50 4.5, 100 8, 194 5.5" />
      <path
        className={styles.threadDone}
        data-stroke=""
        d={`M6 6.5 C ${6 + (end - 6) * 0.3} 4.5, ${6 + (end - 6) * 0.6} 8, ${end} 5.8`}
      />
    </svg>
  );
}

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
            data-intent="reading"
            {...build("type", "titling")}
          >
            Eight hands, <em>one afternoon.</em>
          </h2>
          <p className={layout.prose} data-intent="reading" {...build("develop", "setting text")}>
            Give Kumi a goal and it lays out the strands. Every agent picks one up and works at its
            own pace, in plain view. You watch the cord take shape instead of waiting at a progress
            bar.
          </p>
        </header>

        <ol className={styles.lanes}>
          {LANES.map((lane) => {
            const a = agent(lane.agent);
            return (
              <li
                key={lane.agent}
                className={`${sketch.box} ${styles.lane}`}
                style={{ "--a": a.color } as React.CSSProperties}
                data-intent={`watching ${a.name}`}
                {...build("box", "drawing lane", { agent: a.id })}
              >
                <div className={styles.laneHead} {...build("reveal", "naming lane")}>
                  <span className={layout.dot} />
                  <span className={styles.laneName}>{a.name}</span>
                  <span className={styles.lanePct}>{Math.round(lane.progress * 100)}%</span>
                </div>
                <h3 className={styles.strand} {...build("type", "naming strand")}>
                  {lane.strand}
                </h3>
                <ul className={styles.steps} {...build("list", "listing steps")}>
                  {lane.steps.map((s) => (
                    <li key={s.text} className={styles.step} data-done={s.done}>
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
                <Thread progress={lane.progress} />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
