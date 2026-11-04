import { agent, type AgentId } from "@/lib/agents";
import { build, buildSection } from "@/components/swarm/build";
import layout from "@/components/ui/layout.module.css";
import styles from "./HowItWorks.module.css";

const STEPS: { title: string; body: string; by: AgentId; intent: string }[] = [
  {
    title: "Measure.",
    body: "Say what you want made, in plain words.",
    by: "ren",
    intent: "measuring twice",
  },
  {
    title: "Cut.",
    body: "Kumi splits the work into pieces that can move on their own.",
    by: "ivo",
    intent: "cutting clean",
  },
  {
    title: "Shape.",
    body: "Each agent takes a piece, and you can watch any of them at any time.",
    by: "bea",
    intent: "shaping by hand",
  },
  {
    title: "Fit.",
    body: "Every piece is tested against the others, then handed back as one.",
    by: "tao",
    intent: "testing the fit",
  },
];

const NUMERALS = ["i", "ii", "iii", "iv"];

export function HowItWorks() {
  return (
    <section
      id="method"
      className={styles.section}
      aria-labelledby="method-title"
      {...buildSection("method")}
    >
      <div className={layout.container}>
        <header className={styles.intro}>
          <p className={layout.kicker} {...build("reveal", "labeling")}>
            the method
          </p>
          <h2
            id="method-title"
            className={layout.sectionTitle}
            data-intent="taking notes"
            {...build("type", "titling")}
          >
            Measure. Cut. Shape. <em>Fit.</em>
          </h2>
        </header>

        <ol className={styles.steps}>
          {STEPS.map((s, i) => {
            const a = agent(s.by);
            return (
              <li
                key={s.title}
                className={styles.step}
                style={{ "--a": a.color } as React.CSSProperties}
                data-intent={s.intent}
                data-build-agent={a.id}
              >
                <span className={styles.numeral} aria-hidden="true" {...build("type", "numbering")}>
                  {NUMERALS[i]}
                </span>
                <h3 className={styles.title} {...build("type", "titling step")}>
                  {s.title}
                </h3>
                <p className={styles.body} {...build("develop", "explaining")}>
                  {s.body}
                </p>
                <p className={styles.by} {...build("reveal", "signing")}>
                  <span className={layout.dot} />
                  drawn by {a.name}
                </p>
                {i < STEPS.length - 1 && (
                  <svg
                    className={styles.connector}
                    viewBox="0 0 60 20"
                    aria-hidden="true"
                    {...build("stroke", "drawing arrow")}
                  >
                    <path d="M2 11c14-4 30-5 50-1.5M45 4.5c3 1.8 5.5 3.4 8 5.3-2.8 1.5-5.5 3.2-8 5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
