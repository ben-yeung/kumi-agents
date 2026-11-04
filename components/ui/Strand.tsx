import { build } from "@/components/swarm/build";
import { AGENTS } from "@/lib/agents";
import styles from "./Strand.module.css";

const MID = 120;
const CUT_X = 250;
const SHAPE_X = 500;
const FIT_X = 750;
const JOIN_X = 894;

/** Where each agent's strand sits when the cut has fanned them out. */
const FAN = AGENTS.map((_, i) => 26 + i * 27);
/** Where it comes out of the shaping: neighbours swap places, so strands cross. */
const WOVEN = [2, 0, 3, 1, 6, 4, 7, 5].map((i) => FAN[i]);

const LINE = `M 12 126 C 64 108, 118 134, 170 120 S 226 116, ${CUT_X} ${MID}`;
const TICKS = [52, 104, 156, 208].map((x, i) => {
  const reach = i % 2 ? 22 : 34;
  return `M ${x} ${MID + 18} L ${x + 1} ${MID + 18 + reach}`;
});
const CUT = `M ${CUT_X - 13} ${MID + 36} L ${CUT_X + 15} ${MID - 38}`;
const FINISH = `M ${JOIN_X - 8} ${MID + 1} C 906 122, 918 160, 952 160 C 984 160, 998 134, 991 110 C 984 87, 958 75, 935 84 C 922 89, 914 99, 914 115`;

const fan = (y: number) => `M ${CUT_X} ${MID} C 320 ${MID}, 372 ${y}, ${SHAPE_X} ${y}`;
const shape = (a: number, b: number, i: number) =>
  `M ${SHAPE_X} ${a} C ${600 + i * 6} ${a}, ${650 - i * 6} ${b}, ${FIT_X} ${b}`;
const fit = (y: number) => `M ${FIT_X} ${y} C 816 ${y}, 842 ${MID}, ${JOIN_X} ${MID}`;

/**
 * The method as one length of ink: a single stroke is measured, cut into a
 * strand per agent, worked on separately, and drawn back into one stroke that
 * closes on a small ensō. Brushed like the ensō, four hands draw a part each.
 */
export function Strand({ className }: { className?: string }) {
  return (
    <svg
      className={[styles.strand, className].filter(Boolean).join(" ")}
      viewBox="0 0 1000 240"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.brush}>
        <g {...build("stroke", "measuring", { id: "strand.measure", agent: "ren" })}>
          <path className={styles.ghost} data-stroke="" d={LINE} />
          {TICKS.map((d) => (
            <path key={d} className={styles.tick} data-stroke="" d={d} />
          ))}
          <path className={styles.ink} data-stroke="" d={LINE} />
        </g>
        <g
          {...build("stroke", "cutting", {
            id: "strand.cut",
            agent: "ivo",
            after: ["strand.measure"],
          })}
        >
          <path className={styles.cut} data-stroke="" d={CUT} />
          {AGENTS.map((a, i) => (
            <Thread key={a.id} d={fan(FAN[i])} color={a.color} />
          ))}
        </g>
        <g
          {...build("stroke", "shaping", {
            id: "strand.shape",
            agent: "bea",
            after: ["strand.cut"],
          })}
        >
          {AGENTS.map((a, i) => (
            <Thread key={a.id} d={shape(FAN[i], WOVEN[i], i)} color={a.color} />
          ))}
        </g>
        <g
          {...build("stroke", "fitting", {
            id: "strand.fit",
            agent: "tao",
            after: ["strand.shape"],
          })}
        >
          {AGENTS.map((a, i) => (
            <Thread key={a.id} d={fit(WOVEN[i])} color={a.color} />
          ))}
          <path className={styles.ghost} data-stroke="" d={FINISH} />
          <path className={styles.ink} data-stroke="" d={FINISH} />
        </g>
      </g>
    </svg>
  );
}

function Thread({ d, color }: { d: string; color: string }) {
  return (
    <path
      className={styles.thread}
      data-stroke=""
      d={d}
      style={{ "--c": color } as React.CSSProperties}
    />
  );
}
