"use client";

import { THEME_KEY } from "@/components/prefs/keys";
import { writeStored } from "@/components/prefs/storage";
import { useTagMode } from "@/components/prefs/usePrefs";
import styles from "./Controls.module.css";

function resolvedTheme(): "light" | "dark" {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  function toggle() {
    const next = resolvedTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    writeStored(THEME_KEY, next);
  }

  // Both icons render; CSS shows the one matching the active theme, so the
  // server markup never has to guess.
  return (
    <button
      type="button"
      className={styles.control}
      onClick={toggle}
      aria-label="Switch between light and dark"
      data-intent="lighting"
      data-intent-press="dimming"
    >
      <svg className={styles.sun} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.4 5.5l1.7 1.6M16.9 16.9l1.7 1.7M5.4 18.6l1.7-1.7M16.9 7.1l1.7-1.6" />
      </svg>
      <svg className={styles.moon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.5 14.6A7.8 7.8 0 0 1 9.3 4.4a7.9 7.9 0 1 0 10.2 10.2Z" />
      </svg>
    </button>
  );
}

export function TagModeToggle() {
  const [mode, setMode] = useTagMode();
  const next = mode === "actions" ? "names" : "actions";

  return (
    <button
      type="button"
      className={`${styles.control} ${styles.text}`}
      onClick={() => setMode(next)}
      aria-pressed={mode === "names"}
      data-intent="tag mode"
      data-intent-press="quieting"
    >
      <span className={styles.label}>tags</span>
      <span className={styles.value}>{mode === "actions" ? "name · action" : "name"}</span>
    </button>
  );
}
