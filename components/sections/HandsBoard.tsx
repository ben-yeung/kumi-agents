import { motion } from "motion/react";
import { LaneRule } from "@/components/sections/LaneRule";
import { agent } from "@/lib/agents";
import { COLUMNS, column, type Card, type Work } from "@/lib/lanes";
import layout from "@/components/ui/layout.module.css";
import sketch from "@/components/ui/SketchBox.module.css";
import styles from "./ManyHands.module.css";

const SLIDE = { duration: 0.45, ease: [0.22, 0.61, 0.36, 1] } as const;

/** The same work as the notes, one card per step, sorted by where it stands. */
export function HandsBoard({ work }: { work: Work }) {
  return (
    <div className={styles.board}>
      {COLUMNS.map(({ status, title, intent }) => {
        const list = column(work, status);
        return (
          <section
            key={status}
            className={styles.column}
            data-column={status}
            data-intent={intent}
            aria-label={title}
          >
            <h3 className={styles.columnHead}>
              <span>{title}</span>
              <span className={styles.columnCount}>{list.length}</span>
            </h3>
            <ol className={styles.cards}>
              {list.map((card) => (
                <TaskCard key={card.id} card={card} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function TaskCard({ card }: { card: Card }) {
  const a = agent(card.agent);
  return (
    <motion.li
      layout="position"
      transition={SLIDE}
      className={`${sketch.box} ${styles.card}`}
      style={{ "--a": a.color } as React.CSSProperties}
      data-card={card.id}
      data-status={card.status}
      data-agent={card.agent}
      data-intent={card.intent}
    >
      <div className={styles.cardHead}>
        <span className={layout.dot} />
        <span className={styles.laneName}>{a.name}</span>
        {card.status === "doing" && (
          <span className={styles.lanePct}>{Math.round(card.progress * 100)}%</span>
        )}
      </div>
      <p className={styles.cardText}>{card.text}</p>
      <p className={styles.cardPiece}>{card.piece}</p>
      {card.status === "doing" && <LaneRule progress={card.progress} />}
    </motion.li>
  );
}
