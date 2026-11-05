import styles from "./ManyHands.module.css";

/** A hand-drawn rule whose length reflects progress. */
export function LaneRule({
  progress,
  ...rest
}: { progress: number } & Record<`data-${string}`, string>) {
  const end = 6 + progress * 188;
  return (
    <svg
      className={styles.rule}
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      aria-hidden="true"
      {...rest}
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
