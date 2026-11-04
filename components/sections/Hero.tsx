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
            data-intent="squinting"
            {...build("type", "noting premise", { id: "hero.kicker" })}
          >
            parallel agents, handled with care
          </p>
          <h1
            id="hero-title"
            className={styles.title}
            data-intent="savoring title"
            {...build("type", "drafting title", { id: "hero.title" })}
          >
            Many hands. <em>One clean fit.</em>
          </h1>
          <div
            className={styles.lede}
            data-intent="mulling it over"
            {...build("type", "writing lede", { id: "hero.lede" })}
          >
            <p>
              <span className={styles.brand}>kumi</span> gives every piece of your project its own
              pair of hands.
            </p>
          </div>
          <div className={styles.actions}>
            <a
              href="#waitlist"
              className={button.primary}
              data-intent="feeling brave"
              data-intent-press="signing up"
              {...build("box", "shaping button", { id: "hero.cta" })}
            >
              Join the waitlist
              <ArrowRight />
            </a>
            <a
              href="#hands"
              className={button.secondary}
              data-intent="pulling a chair"
              data-intent-press="sitting down"
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
            the next innovation, sewn together
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
              data-intent={a.greeting}
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
