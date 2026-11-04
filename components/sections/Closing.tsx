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
        id="waitlist"
        className={styles.section}
        aria-labelledby="waitlist-title"
        {...buildSection("closing")}
      >
        <div className={`${layout.container} ${styles.inner}`}>
          <Enso className={styles.enso} {...build("stroke", "painting ensō")} />
          <h2
            id="waitlist-title"
            className={styles.title}
            data-intent="warming up"
            {...build("type", "inviting")}
          >
            The hands are <em>ready.</em>
          </h2>
          <p className={styles.body} data-intent="considering" {...build("type", "promising")}>
            Bring the plans. We will bring the crew.
          </p>
          <a
            href="#waitlist"
            className={button.primary}
            data-intent="ready now"
            data-intent-press="here goes"
            {...build("box", "shaping button")}
          >
            Join the waitlist
            <ArrowRight />
          </a>
        </div>
      </section>

      <footer className={styles.footer} {...buildSection("footer")}>
        <div className={`${layout.container} ${styles.footInner}`}>
          <Wordmark />
          <div className={styles.footCenter}>
            <p
              className={styles.signoff}
              data-intent="returning a bow"
              {...build("type", "signing off", { agent: "tao" })}
            >
              Made with care, by many hands.
              <span className={styles.signed}>signed, tao</span>
            </p>
            <p className={styles.small}>&copy; 2026 Kumi</p>
          </div>
        </div>
      </footer>
    </>
  );
}
