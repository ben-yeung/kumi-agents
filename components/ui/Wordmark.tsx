import { build } from "@/components/swarm/build";
import styles from "./Wordmark.module.css";

/**
 * Kumi wordmark: three slats crossing at a joint, then the name.
 * With `buildable`, the crew sets the joint and signs the name.
 */
export function Wordmark({ buildable = false }: { buildable?: boolean }) {
  return (
    <span className={styles.mark}>
      <svg
        className={styles.joint}
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
        {...(buildable ? build("stroke", "setting joint", { id: "nav.joint" }) : {})}
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
