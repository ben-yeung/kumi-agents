import { ThemeToggle } from "@/components/prefs/Controls";
import { build, buildSection } from "@/components/swarm/build";
import { Wordmark } from "@/components/ui/Wordmark";
import layout from "@/components/ui/layout.module.css";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "#hands", label: "Hands", intent: "scouting crew" },
  { href: "#method", label: "Method", intent: "pondering craft" },
  { href: "#log", label: "Log", intent: "skimming log" },
];

export function Nav() {
  return (
    <header className={styles.header} {...buildSection("hero")}>
      <nav className={`${layout.container} ${styles.nav}`} aria-label="Main">
        <a href="#top" className={styles.brand} data-intent="admiring logo" aria-label="Kumi, home">
          <Wordmark buildId="nav" />
        </a>
        <ul className={styles.links} {...build("list", "laying nav", { id: "nav.links" })}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className={styles.link} data-intent={l.intent}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div
          className={styles.controls}
          {...build("list", "fitting toggles", { id: "nav.controls" })}
        >
          <ThemeToggle />
          <a
            href="#waitlist"
            className={styles.join}
            aria-label="Join the waitlist"
            data-intent="tempted"
            data-intent-press="diving in"
          >
            Join<span className={styles.joinRest}> the waitlist</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
