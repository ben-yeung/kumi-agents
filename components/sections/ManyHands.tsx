import { agent, type AgentId } from "@/lib/agents";
import { build, buildSection } from "@/components/swarm/build";
import layout from "@/components/ui/layout.module.css";
import sketch from "@/components/ui/SketchBox.module.css";
import styles from "./ManyHands.module.css";

type Lane = {
  agent: AgentId;
  piece: string;
  /** What the visitor's tag says hovering this lane. */
  intent: string;
  steps: { text: string; done: boolean }[];
  progress: number;
};

const LANES: Lane[] = [
  {
    agent: "ren",
    piece: "Draft data model",
    intent: "admiring schema",
    steps: [
      { text: "sketch entities", done: true },
      { text: "name relations", done: true },
      { text: "write schema", done: false },
    ],
    progress: 0.72,
  },
  {
    agent: "sol",
    piece: "Write onboarding copy",
    intent: "proofing copy",
    steps: [
      { text: "read brief", done: true },
      { text: "first pass, plain words", done: false },
      { text: "trim by a third", done: false },
    ],
    progress: 0.41,
  },
  {
    agent: "ivo",
    piece: "Align new screens",
    intent: "eyeing the grid",
    steps: [
      { text: "measure spacing", done: true },
      { text: "set type scale", done: true },
      { text: "even out margins", done: false },
    ],
    progress: 0.64,
  },
  {
    agent: "mika",
    piece: "Tighten test suite",
    intent: "trusting tests",
    steps: [
      { text: "find flaky ones", done: true },
      { text: "fix clock", done: true },
      { text: "add edge cases", done: false },
    ],
    progress: 0.93,
  },
  {
    agent: "juno",
    piece: "Read payments docs",
    intent: "skimming docs",
    steps: [
      { text: "skim guides", done: true },
      { text: "note webhooks", done: false },
      { text: "flag gotchas", done: false },
    ],
    progress: 0.28,
  },
  {
    agent: "oki",
    piece: "Clear out old helpers",
    intent: "sweeping up",
    steps: [
      { text: "find unused code", done: true },
      { text: "rename flags", done: false },
      { text: "remove dead routes", done: false },
    ],
    progress: 0.36,
  },
  {
    agent: "bea",
    piece: "Rough in settings page",
    intent: "sizing it up",
    steps: [
      { text: "block out layout", done: true },
      { text: "two columns, not three", done: true },
      { text: "draw mobile view", done: false },
    ],
    progress: 0.58,
  },
  {
    agent: "tao",
    piece: "Check that pieces fit",
    intent: "checking joints",
    steps: [
      { text: "compare pieces", done: true },
      { text: "run full suite", done: false },
      { text: "sign off work", done: false },
    ],
    progress: 0.19,
  },
];

/** A hand-drawn rule whose length reflects progress. */
function Rule({ progress }: { progress: number }) {
  const end = 6 + progress * 188;
  return (
    <svg
      className={styles.rule}
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      {...build("stroke", "marking progress")}
    >
      <path className={styles.ruleBase} d="M6 6.5 C 50 4.5, 100 8, 194 5.5" />
      <path
        className={styles.ruleDone}
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

        <ol className={styles.lanes}>
          {LANES.map((lane) => {
            const a = agent(lane.agent);
            return (
              <li
                key={lane.agent}
                className={`${sketch.box} ${styles.lane}`}
                style={{ "--a": a.color } as React.CSSProperties}
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
                <Rule progress={lane.progress} />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
