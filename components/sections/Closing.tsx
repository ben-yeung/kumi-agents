import { ArrowRight } from "@/components/ui/Arrow";
import button from "@/components/ui/Button.module.css";
import { Enso } from "@/components/ui/Enso";
import { build, buildSection } from "@/components/swarm/build";
import layout from "@/components/ui/layout.module.css";
import { Wordmark } from "@/components/ui/Wordmark";
import styles from "./Closing.module.css";

export function Closing() {
  return (
    <>
      <section
        id="begin"
        className={styles.section}
        aria-labelledby="begin-title"
        {...buildSection("closing")}
      >
        <div className={`${layout.container} ${styles.inner}`}>
          <Enso className={styles.enso} {...build("stroke", "painting ensō")} />
          <h2
            id="begin-title"
            className={styles.title}
            data-intent="nearly ready"
            {...build("type", "inviting")}
          >
            The hands are <em>ready.</em>
          </h2>
          <p className={styles.body} data-intent="considering" {...build("type", "promising")}>
            Bring a pattern. We will bring the crew.
          </p>
          <a
            href="#begin"
            className={button.primary}
            data-intent="almost in"
            data-intent-press="beginning"
            {...build("box", "shaping button")}
          >
            Begin a braid
            <ArrowRight />
          </a>
        </div>
      </section>

      <footer className={styles.footer} {...buildSection("footer")}>
        <div className={`${layout.container} ${styles.footInner}`}>
          <Wordmark />
          <p
            className={styles.signoff}
            data-intent="reading sign-off"
            {...build("type", "signing off", { agent: "tao" })}
          >
            Made slowly, by many hands.
            <span className={styles.signed}>signed, tao</span>
          </p>
          <p className={styles.small}>&copy; 2026 Kumi</p>
        </div>
      </footer>
    </>
  );
}
