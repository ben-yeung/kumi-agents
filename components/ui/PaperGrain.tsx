import styles from "./PaperGrain.module.css";

/**
 * Fixed paper-grain overlay plus shared SVG filter defs used for
 * hand-drawn edges (`filter: url(#kumi-wobble)`).
 */
export function PaperGrain() {
  return (
    <>
      <svg className={styles.defs} aria-hidden="true" focusable="false">
        <defs>
          <filter id="kumi-wobble" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="2.6" />
          </filter>
          <filter id="kumi-brush" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="3"
              result="fine"
            />
            <feDisplacementMap in="SourceGraphic" in2="fine" scale="3.2" result="frayed" />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02"
              numOctaves="1"
              seed="11"
              result="broad"
            />
            <feDisplacementMap in="frayed" in2="broad" scale="5" />
          </filter>
        </defs>
      </svg>
      <div className={styles.grain} aria-hidden="true" />
    </>
  );
}
