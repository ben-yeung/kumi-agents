import { build } from "@/components/swarm/build";
import styles from "./Wordmark.module.css";

/**
 * Kumi wordmark: three strands crossing into a knot, then the name.
 * With `buildable`, the crew ties the knot and signs the name.
 */
export function Wordmark({ buildable = false }: { buildable?: boolean }) {
  return (
    <span className={styles.mark}>
      <svg
        className={styles.knot}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
        {...(buildable ? build("stroke", "tying knot", { id: "nav.knot" }) : {})}
      >
        <path d="M5 9c7 1 14 13 22 14" />
        <path d="M5 23c8-1 13-13 22-14" />
        <path d="M4.5 16.2c7.6-.6 15.4.5 23 0" />
      </svg>
      <span
        className={styles.word}
        {...(buildable ? build("type", "signing", { id: "nav.word" }) : {})}
      >
        kumi
      </span>
    </span>
  );
}
