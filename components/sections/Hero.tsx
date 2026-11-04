import { AGENTS } from "@/lib/agents";
import { build, buildSection } from "@/components/swarm/build";
import { ArrowRight } from "@/components/ui/Arrow";
import button from "@/components/ui/Button.module.css";
import { Enso } from "@/components/ui/Enso";
import layout from "@/components/ui/layout.module.css";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section
      id="top"
      className={styles.hero}
      aria-labelledby="hero-title"
      {...buildSection("hero")}
    >
      <div className={`${layout.container} ${styles.grid}`}>
        <div className={styles.copy} {...build("frame", "scaffolding", { id: "hero.copy" })}>
          <p
            className={layout.kicker}
            data-intent="reading"
            {...build("type", "noting premise", { id: "hero.kicker" })}
          >
            parallel agents, handled with care
          </p>
          <h1
            id="hero-title"
            className={styles.title}
            data-intent="reading title"
            {...build("type", "drafting title", { id: "hero.title" })}
          >
            Work, braided by <em>many hands.</em>
          </h1>
          <p
            className={styles.lede}
            data-intent="reading lede"
            {...build("type", "writing lede", { id: "hero.lede" })}
          >
            Kumi runs a quiet crew of agents in parallel. Each takes a strand, none waits on
            another, and the work comes together whole.
          </p>
          <div className={styles.actions}>
            <a
              href="#begin"
              className={button.primary}
              data-intent="almost in"
              data-intent-press="beginning"
              {...build("box", "shaping button", { id: "hero.cta" })}
            >
              Begin a braid
              <ArrowRight />
            </a>
            <a
              href="#hands"
              className={button.secondary}
              data-intent="curious"
              data-intent-press="watching"
              {...build("reveal", "adding link", { id: "hero.watch" })}
            >
              Watch them work
            </a>
          </div>
        </div>

        <figure
          className={styles.art}
          data-intent="tracing ensō"
          {...build("stroke", "painting ensō", { id: "hero.enso" })}
        >
          <Enso className={styles.enso} />
          <figcaption
            className={styles.caption}
            {...build("type", "captioning", { id: "hero.caption" })}
          >
            one cord, eight strands
          </figcaption>
        </figure>
      </div>

      <div className={layout.container}>
        <ul
          className={styles.crew}
          aria-label="Today's crew"
          data-intent="meeting crew"
          {...build("list", "listing crew", { id: "hero.crew" })}
        >
          <li className={styles.crewLabel}>today&rsquo;s crew</li>
          {AGENTS.map((a) => (
            <li
              key={a.id}
              className={styles.member}
              style={{ "--a": a.color } as React.CSSProperties}
              data-intent={`waving at ${a.name}`}
              title={a.temperament}
            >
              <span className={layout.dot} />
              {a.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
