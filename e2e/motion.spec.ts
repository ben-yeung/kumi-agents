// How alive the crew looks through the hero intro, per choreography:
// - still: the longest an agent stays put
// - edge: the longest an agent hangs about at the side of the screen
// - label: how long a tag's wording lasts
// - words: everything tags said, none of which may be passive
import type { Browser } from "@playwright/test";
import { CHOREOGRAPHIES } from "@/components/swarm/choreographies";
import { expect, NAMES, replayButton, test, watchErrors, type Sample } from "./support";

/** Choreographies are picked at random, so loads go on until each has been seen this often. */
const LOADS_EACH = 3;
const LOADS_AT_ONCE = 8;
const MOST_BATCHES = 6;
const AFTER_SETTLE_MS = 9000;
const SAMPLE_MS = 100;
/** A label held for fewer samples than this is still being typed into the tag. */
const STABLE_SAMPLES = 4;
const LIMITS = { stillSeconds: 4.5, shortestLabelSeconds: 1.2, edgeSeconds: 1.2 };
const VIEWPORT = { width: 1440, height: 900 };
/** Closer to the side of the screen than this, only a name tag shows. */
const EDGE = 40;
const PASSIVE = /\b(rest|paus|wait|leav|stretch|tidy|pairing)/;

type Run = { choreography: string | null; tasks: string[]; samples: Sample[] };

/** One visit in its own context, so nothing carries over from the last one. */
async function load(browser: Browser): Promise<Run> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const errors = watchErrors(page);
  await page.addInitScript(
    ({ every, names }) => {
      window.__samples = [];
      const t0 = performance.now();
      setInterval(() => {
        const settled = [...document.querySelectorAll("[data-swarm-controls] button")].some((b) =>
          b.textContent!.includes("replay"),
        );
        for (const el of document.querySelectorAll("[data-swarm-agent]")) {
          const text = el.textContent!.trim();
          const name = names.find((n) => text.startsWith(n));
          if (!name) continue;
          const box = el.getBoundingClientRect();
          window.__samples.push({
            t: performance.now() - t0,
            name,
            action: text.slice(name.length).replace(/^\W+/, ""),
            x: box.x,
            y: box.y,
            settled,
          });
        }
      }, every);
    },
    { every: SAMPLE_MS, names: NAMES },
  );
  await page.goto("/");
  await replayButton(page).waitFor({ timeout: 40_000 });
  await page.waitForTimeout(AFTER_SETTLE_MS);
  const run = await page.evaluate(() => ({
    tasks: [
      ...new Set(
        [...document.querySelectorAll<HTMLElement>("[data-build-label]")].map(
          (el) => el.dataset.buildLabel!,
        ),
      ),
    ],
    choreography: sessionStorage.getItem("kumi-last-choreo"),
    samples: window.__samples,
  }));
  await context.close();
  expect(errors, "page and console errors").toEqual([]);
  return run;
}

/** Consecutive samples with the same wording: what the tag said, and for how long. */
function labelRuns(samples: Sample[]) {
  const out: { action: string; start: number; end: number; n: number }[] = [];
  for (const s of samples) {
    const current = out.at(-1);
    if (current?.action === s.action) {
      current.end = s.t;
      current.n++;
    } else out.push({ action: s.action, start: s.t, end: s.t, n: 1 });
  }
  return out.filter((r) => r.n >= STABLE_SAMPLES && r.action);
}

/** The longest an agent stayed within a few pixels, in seconds. */
function longestStill(samples: Sample[]) {
  let longest = 0;
  let from: Sample | null = null;
  for (const s of samples) {
    if (from && Math.hypot(s.x - from.x, s.y - from.y) < 3) {
      longest = Math.max(longest, s.t - from.t);
    } else from = s;
  }
  return longest / 1000;
}

/** The longest an agent hung about at the very edge of the screen, in seconds. */
function longestAtEdge(samples: Sample[]) {
  // The nav lives along the top, so only being off the top counts there.
  const atEdge = (s: Sample) =>
    s.x < EDGE || s.x > VIEWPORT.width - EDGE || s.y < 0 || s.y > VIEWPORT.height - EDGE;
  let longest = 0;
  let from: Sample | null = null;
  for (const s of samples) {
    if (!atEdge(s)) from = null;
    else {
      from ??= s;
      longest = Math.max(longest, s.t - from.t);
    }
  }
  return longest / 1000;
}

test("every choreography keeps the crew busy, in active words", async ({ browser }) => {
  test.setTimeout(240_000);
  const names = CHOREOGRAPHIES.map((c) => c.name);
  const seen = (runs: Run[], name: string) => runs.filter((r) => r.choreography === name);

  const runs: Run[] = [];
  for (let batch = 0; batch < MOST_BATCHES; batch++) {
    if (names.every((n) => seen(runs, n).length >= LOADS_EACH)) break;
    runs.push(...(await Promise.all(Array.from({ length: LOADS_AT_ONCE }, () => load(browser)))));
  }

  for (const name of names) {
    const mine = seen(runs, name);
    expect(mine.length, `${name} loads`).toBeGreaterThanOrEqual(LOADS_EACH);

    const agents = mine.flatMap((r) =>
      [...new Set(r.samples.map((s) => s.name))].map((n) => r.samples.filter((s) => s.name === n)),
    );
    const perAgent = agents.map(labelRuns);
    const words = [...new Set(perAgent.flat().map((r) => r.action))];
    // A word that starts a longer one is the tag still typing or erasing.
    const whole = (w: string) => !words.some((o) => o !== w && o.startsWith(w));
    const labels = perAgent.map((list) => list.filter((r) => whole(r.action)));
    // Real build steps can be quick; it is what agents do between them that must not flit.
    const tasks = new Set([...mine.flatMap((r) => r.tasks), "hmm, no"]);
    const chores = labels.flatMap((list) => list.slice(1, -1)).filter((r) => !tasks.has(r.action));
    const shortest = Math.min(...chores.map((r) => (r.end - r.start) / 1000));
    // While the hero is going up, tags only ever name real build work.
    const introWords = new Set(
      mine.flatMap((r) => r.samples.filter((s) => !s.settled).map((s) => s.action)),
    );
    const final = words.filter(whole);

    expect
      .soft(Math.max(...agents.map(longestStill)), `${name}: longest stood still`)
      .toBeLessThanOrEqual(LIMITS.stillSeconds);
    // Heading off the page at the end is fine; it is hanging about in the intro that shows.
    expect
      .soft(
        Math.max(...agents.map((list) => longestAtEdge(list.filter((s) => !s.settled)))),
        `${name}: longest at the edge`,
      )
      .toBeLessThanOrEqual(LIMITS.edgeSeconds);
    expect
      .soft(shortest, `${name}: shortest chore`)
      .toBeGreaterThanOrEqual(LIMITS.shortestLabelSeconds);
    expect
      .soft(
        final.filter((w) => PASSIVE.test(w)),
        `${name}: passive words`,
      )
      .toEqual([]);
    expect
      .soft(
        final.filter((w) => introWords.has(w) && !tasks.has(w)),
        `${name}: chores mid-build`,
      )
      .toEqual([]);
  }
});
