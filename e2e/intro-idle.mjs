// Measures how alive the crew looks through the hero intro, per choreography:
// - still: the longest an agent stays put
// - label: how long a tag's wording lasts, and how often it flips
// - words: everything tags said, none of which may be passive
// Usage: node e2e/intro-idle.mjs http://localhost:<port> [loads] [--strict]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const loads = Number(process.argv[3] ?? 12);
const strict = process.argv.includes("--strict");
const AFTER_SETTLE_MS = 9000;
const SAMPLE_MS = 100;
/** A label held for fewer samples than this is still being typed into the tag. */
const STABLE_SAMPLES = 4;
const LIMITS = { stillSeconds: 4.5, shortestLabelSeconds: 1.2 };
const PASSIVE = /\b(rest|paus|wait|leav|stretch|tidy|pairing)/;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const runs = [];

for (let i = 0; i < loads; i++) {
  await page.addInitScript((every) => {
    window.__samples = [];
    const names = ["ren", "sol", "ivo", "mika", "juno", "oki", "bea", "tao"];
    const t0 = performance.now();
    setInterval(() => {
      const settled = [...document.querySelectorAll("[data-swarm-controls] button")].some((b) =>
        b.textContent.includes("replay"),
      );
      for (const el of document.querySelectorAll("[data-swarm-agent]")) {
        const text = el.textContent.trim();
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
  }, SAMPLE_MS);
  await page.goto(base);
  await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
  await page.waitForTimeout(AFTER_SETTLE_MS);
  runs.push({
    tasks: await page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("[data-build-label]")].map((el) => el.dataset.buildLabel),
      ),
    ]),
    choreography: await page.evaluate(() => sessionStorage.getItem("kumi-last-choreo")),
    samples: await page.evaluate(() => window.__samples),
  });
}
await browser.close();

/** Consecutive samples with the same wording: what the tag said, and for how long. */
function labelRuns(samples) {
  const out = [];
  let current = null;
  for (const s of samples) {
    if (current && current.action === s.action) current.end = s.t;
    else out.push((current = { action: s.action, start: s.t, end: s.t, n: 0 }));
    current.n++;
  }
  return out.filter((r) => r.n >= STABLE_SAMPLES && r.action);
}

/** The longest an agent stayed within a few pixels. */
function longestStill(samples) {
  let longest = 0;
  let from = null;
  for (const s of samples) {
    if (from && Math.hypot(s.x - from.x, s.y - from.y) < 3)
      longest = Math.max(longest, s.t - from.t);
    else from = s;
  }
  return longest / 1000;
}

const totals = { still: 0, shortest: Infinity, passive: new Set(), midBuild: new Set() };

for (const name of [...new Set(runs.map((r) => r.choreography))].sort()) {
  const mine = runs.filter((r) => r.choreography === name);
  const agents = mine.flatMap((r) =>
    [...new Set(r.samples.map((s) => s.name))].map((n) => r.samples.filter((s) => s.name === n)),
  );
  const still = Math.max(...agents.map(longestStill));
  const perAgent = agents.map(labelRuns);
  const words = [...new Set(perAgent.flat().map((r) => r.action))];
  // A word that starts a longer one is the tag still typing or erasing.
  const whole = (w) => !words.some((o) => o !== w && o.startsWith(w));
  const labels = perAgent.map((list) => list.filter((r) => whole(r.action)));
  // Real build steps can be quick; it is what agents do between them that must not flit.
  const tasks = new Set([...mine.flatMap((r) => r.tasks), "hmm, no"]);
  const middle = labels.flatMap((list) => list.slice(1, -1)).filter((r) => !tasks.has(r.action));
  const shortest = Math.min(...middle.map((r) => (r.end - r.start) / 1000));
  const seconds = agents.reduce((sum, list) => sum + list.length * (SAMPLE_MS / 1000), 0);
  const final = words.filter(whole);
  // While the hero is going up, tags only ever name real build work.
  const introWords = new Set(
    mine.flatMap((r) => r.samples.filter((s) => !s.settled).map((s) => s.action)),
  );
  final.filter((w) => introWords.has(w) && !tasks.has(w)).forEach((w) => totals.midBuild.add(w));
  final.filter((w) => PASSIVE.test(w)).forEach((w) => totals.passive.add(w));
  totals.still = Math.max(totals.still, still);
  totals.shortest = Math.min(totals.shortest, shortest);
  console.log(`\n${name} (${mine.length} loads)`);
  console.log(`  longest stood still ${still.toFixed(1)}s`);
  console.log(`  shortest chore      ${shortest.toFixed(1)}s`);
  console.log(
    `  label changes       ${((labels.flat().length / seconds) * 60).toFixed(0)} per agent-minute`,
  );
  console.log(`  words               ${final.join(", ")}`);
}

const ok =
  totals.still <= LIMITS.stillSeconds &&
  totals.shortest >= LIMITS.shortestLabelSeconds &&
  totals.passive.size === 0 &&
  totals.midBuild.size === 0;
console.log(
  `\nworst: still ${totals.still.toFixed(1)}s, shortest label ${totals.shortest.toFixed(1)}s, ` +
    `passive [${[...totals.passive].join(", ")}], ` +
    `chores mid-build [${[...totals.midBuild].join(", ")}]`,
);
if (strict) process.exit(ok ? 0 : 1);
