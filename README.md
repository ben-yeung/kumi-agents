# Kumi landing page

A landing page for Kumi, a fictional agentic startup built around parallel agent work.
The page builds itself: a crew of agent cursors draws, types and places the real page content, in parallel, as it scrolls into view.

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
- `engine.ts` runs the crew: scroll activation, growing and thinning the crew, skip and replay.

The overall pace is one constant, `TEMPO` in `engine.ts`.

Visitors who prefer reduced motion get the finished page with no cursors.
If the scripts never run, content is released after a few seconds, so it always shows.

## End-to-end scripts

These drive a running server with Playwright.
Run `npx playwright install chromium` once first.

```bash
node e2e/behaviors.mjs http://localhost:3000       # behavior checks
node e2e/screenshots.mjs http://localhost:3000     # mobile, laptop, 4K, both themes
node e2e/intro-frames.mjs http://localhost:3000    # frames of the intro and scroll build
```

Screenshots go to `e2e/.shots/`, which is ignored by git.
