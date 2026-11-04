import styles from "./Pointer.module.css";

export type PointerVariant = "dart" | "hand" | "ibeam" | "cross" | "pencil" | "loupe";

/**
 * Flat pointers shared by the visitor and the agents. Color comes from `--c`,
 * and each one's hotspot sits at the element's origin:
 * - dart: travelling, the tip of a paper airplane
 * - hand: clicking and placing, the fingertip
 * - ibeam: writing, the center of the beam
 * - cross: drawing containers, the center of the crosshair
 * - pencil: drawing strokes, the point
 * - loupe: checking, the center of the lens
 */
export function Pointer({ variant = "dart" }: { variant?: PointerVariant }) {
  const shared = { "aria-hidden": true, focusable: false } as const;
  switch (variant) {
    case "hand":
      return (
        <svg className={styles.hand} viewBox="0 0 18 22" {...shared}>
          <path d="M6.3 1.2c1.2 0 2.1.9 2.1 2.1v6.1l5.5 1.1c1.5.3 2.5 1.6 2.4 3.1l-.3 4.3c-.2 1.9-1.7 3.3-3.6 3.3H8.9c-1.1 0-2.2-.5-2.9-1.4l-4.5-5.7c-.7-.9-.1-2.2 1-2.3.6 0 1.2.2 1.6.7V3.3c0-1.2.9-2.1 2.2-2.1Z" />
        </svg>
      );
    case "ibeam":
      return (
        <svg className={styles.ibeam} viewBox="0 0 20 20" {...shared}>
          <path d="M6.5 2.5c2 0 3.5.8 3.5 2.2v10.6c0 1.4-1.5 2.2-3.5 2.2M13.5 2.5c-2 0-3.5.8-3.5 2.2v10.6c0 1.4 1.5 2.2 3.5 2.2" />
        </svg>
      );
    case "cross":
      return (
        <svg className={styles.cross} viewBox="0 0 20 20" {...shared}>
          <path d="M10 2v16M2 10h16" />
        </svg>
      );
    case "pencil":
      return (
        <svg className={styles.pencil} viewBox="0 0 20 20" {...shared}>
          <path d="M1.5 1.5 3.6 8l10 10q1 1 2 0l2.4-2.4q1-1 0-2l-10-10Z" />
        </svg>
      );
    case "loupe":
      return (
        <svg className={styles.loupe} viewBox="0 0 20 20" {...shared}>
          <circle cx="8" cy="8" r="5.6" />
          <path d="M12.3 12.3 18 18" />
        </svg>
      );
    default:
      return (
        <svg className={styles.dart} viewBox="0 0 20 20" {...shared}>
          <path d="M1.5 1.5 18.5 7.6 10.6 10.6 7.6 18.5Z" />
        </svg>
      );
  }
}
