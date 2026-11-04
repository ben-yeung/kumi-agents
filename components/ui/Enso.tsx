import styles from "./Enso.module.css";

/**
 * A single-stroke ensō. The path is deliberately uneven: it starts heavy,
 * thins as it travels, and leaves a gap where the brush lifted. A dry,
 * offset second pass sits underneath; both draw together when built.
 */
export const ENSO_PATH =
  "M 132 44 C 104 22, 58 26, 38 58 C 16 92, 26 146, 64 168 C 104 190, 156 178, 174 138 C 188 106, 180 70, 156 52";

export function Enso({
  className,
  ...rest
}: { className?: string } & Record<`data-${string}`, string>) {
  return (
    <svg
      className={[styles.enso, className].filter(Boolean).join(" ")}
      viewBox="0 0 210 210"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path className={styles.ghost} d={ENSO_PATH} />
      <path className={styles.stroke} d={ENSO_PATH} />
    </svg>
  );
}
