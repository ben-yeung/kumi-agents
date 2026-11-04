import { TagModeToggle, ThemeToggle } from "@/components/prefs/Controls";
import { build, buildSection } from "@/components/swarm/build";
import { Wordmark } from "@/components/ui/Wordmark";
import layout from "@/components/ui/layout.module.css";
import styles from "./Nav.module.css";

const LINKS = [
  { href: "#hands", label: "Hands", intent: "eyeing hands" },
  { href: "#method", label: "Method", intent: "eyeing method" },
  { href: "#log", label: "Log", intent: "eyeing log" },
];

export function Nav() {
  return (
    <header className={styles.header} {...buildSection("hero")}>
      <nav className={`${layout.container} ${styles.nav}`} aria-label="Main">
        <a href="#top" className={styles.brand} data-intent="admiring" aria-label="Kumi, home">
          <Wordmark buildable />
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
          <TagModeToggle />
          <ThemeToggle />
          <a
            href="#begin"
            className={styles.begin}
            data-intent="almost in"
            data-intent-press="beginning"
          >
            Begin
          </a>
        </div>
      </nav>
    </header>
  );
}
