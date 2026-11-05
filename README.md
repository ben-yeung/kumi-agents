<p align="center">
  <img src="app/icon.svg" alt="Kumi logo" width="96" height="96">
</p>

# Kumi Agents

A landing page for Kumi, a fictional agentic startup built around parallel agent work.
The page builds itself: a crew of agent cursors draws, types and places the real page content, in parallel, as it scrolls into view.

## The story

Kumi (組) means to put together, and also a group or crew.
It is the first half of _kumiko_, the Japanese craft of fitting small, separately cut pieces of wood into one lattice without nails.
No single piece makes the panel; the strength comes from every joint fitting the next one.

The name and story are a draft, see [docs/narrative.md](docs/narrative.md).

## Running it

```bash
npm install
npm run dev
```

| Command             | What it does         |
| ------------------- | -------------------- |
| `npm run dev`       | Start the dev server |
| `npm run build`     | Production build     |
| `npm run typecheck` | TypeScript checks    |
| `npm run lint`      | ESLint               |
| `npm test`          | Unit tests (Vitest)  |
| `npm run format`    | Format with Prettier |

Tests need Node 20.18 or later.

## How the page builds

Sections are server components, rendered in full.
They mark anything the crew should build with `data-build` attributes, using the `build()` helper:

```tsx
<h2 {...build("type", "titling")}>Eight hands</h2>
```

The swarm engine in `components/swarm/` reads those attributes and turns each one into a task.

- `scheduler.ts` decides who takes what. It is pure and unit tested.
- `choreographies.ts` holds the four hero choreographies. Each load picks a random cast and never repeats the previous choreography.
- `effects.ts` holds the build effects: type, box, frame, stroke, develop, list and reveal.
- `engine.ts` runs the crew: scroll activation, calling agents in for signed work, skip and replay.
- `roster.ts` decides who rests on the crew and who comes in next, so every agent gets a turn.

Anything marked with an agent's name is only ever done by that agent.
If they are away the engine calls them in, and the crew counter follows.
Once a section is finished, agents do a few chores from their own craft, and each piece of work gets one pass.
While a section is going up, anyone without a part left stays quiet.
When nothing is left they leave for a named objective, so the page stays uncrowded.
Live work uses the same rule: work-log rows, and errands such as moving a card along the #hands board.

A visit that opens further down the page skips the intro: the section in view builds first, then the crew works back up to the hero.
Whatever the visitor is looking at always comes first.

The overall pace is one constant, `TEMPO` in `engine.ts`.

Visitors who prefer reduced motion get the finished page with no cursors.
If the scripts never run, content is released after a few seconds, so it always shows.

## End-to-end scripts

These drive a running server with Playwright.
Run `npx playwright install chromium` once first.

```bash
node e2e/behaviors.mjs http://localhost:3000       # behavior checks
node e2e/crew.mjs http://localhost:3000            # authorship, rotation, notes, board, footer
node e2e/board.mjs http://localhost:3000           # cards finish at 100%, agents add tasks, replay
node e2e/landing.mjs http://localhost:3000         # opening mid-page builds what is in view first
node e2e/intro-idle.mjs http://localhost:3000 --strict  # nobody stands still or says anything passive
node e2e/screenshots.mjs http://localhost:3000     # mobile, laptop, 4K, both themes
node e2e/intro-frames.mjs http://localhost:3000    # frames of the intro and scroll build
```

Screenshots go to `e2e/.shots/`, which is ignored by git.
