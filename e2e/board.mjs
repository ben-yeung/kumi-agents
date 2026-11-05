// End-to-end checks of how the agents' work moves along:
// - marking progress on the board takes a card to 100% and moves it to Completed
// - finished agents add new tasks, on the board and the notes
// - replay brings back the original work
// Usage: node e2e/board.mjs http://localhost:<port> [seconds]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const seconds = Number(process.argv[3] ?? 60);
/** How long a marked card may sit still before it counts as left unfinished. */
const STALL_MS = 3500;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(base);
await page.getByRole("button", { name: "skip intro" }).click();
await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
await page.getByRole("button", { name: "board" }).click();
await page.evaluate(() =>
  document.querySelector("[data-column]").scrollIntoView({ block: "center" }),
);

await page.evaluate(() => {
  window.__cards = {};
  setInterval(() => {
    const now = performance.now();
    for (const el of document.querySelectorAll("[data-card]")) {
      const c = (window.__cards[el.dataset.card] ??= {
        first: el.dataset.status,
        pcts: [],
        changedAt: 0,
      });
      c.status = el.dataset.status;
      if (el.dataset.status !== "doing") continue;
      const pct = Number(el.textContent.match(/(\d+)%/)?.[1]);
      if (c.pcts.at(-1) === pct) continue;
      if (c.pcts.length) c.changedAt = now;
      c.pcts.push(pct);
    }
    window.__now = now;
  }, 40);
});

await page.waitForTimeout(seconds * 1000);
// However short the run, carry on until an agent has added something.
await page
  .waitForSelector('[data-card*="-1-"]', { state: "attached", timeout: 120000 })
  .catch(() => {});
const { cards, now } = await page.evaluate(() => ({ cards: window.__cards, now: window.__now }));
const counts = await page.evaluate(() => ({
  all: document.querySelectorAll("[data-card]").length,
  done: document.querySelectorAll('[data-column="done"] [data-card]').length,
  round: document.querySelectorAll('[data-card*="-1-"], [data-card*="-2-"]').length,
}));

/** Waits for a condition in the page, and reports whether it came true. */
const until = (fn, arg, timeout = 90000) =>
  page.waitForFunction(fn, arg, { timeout }).then(
    () => true,
    () => false,
  );

const scrollTo = (selector) =>
  page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), selector);
// The notes: a finished agent rewrites their note in place.
await page.getByRole("button", { name: "notes" }).click();
await scrollTo("[data-lane]");
const unbuilt = () => page.locator("#hands [data-build]:not([data-built])").count();
const titles = () =>
  page.evaluate(() => [...document.querySelectorAll("[data-lane] h3")].map((h) => h.textContent));
const before = await titles();
const height = () =>
  page.evaluate(() => document.querySelector("[data-lane]").getBoundingClientRect().height);
const noteHeight = await height();
const rewritten = await until(
  (old) =>
    [...document.querySelectorAll("[data-lane] h3")].some((h, i) => h.textContent !== old[i]),
  before,
);
// Another agent can be writing by now, so wait for a moment when no note is.
const whole = await until(() => !document.querySelector("[data-lane] [data-unwritten]"));
const looseNotes = await unbuilt();
const heightAfter = await height();

// Replay starts everything over, then the crew builds it again.
const original = "Choose a payments provider";
await page.getByRole("button", { name: "replay" }).click();
await page.getByRole("button", { name: "skip intro" }).click();
await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
await scrollTo("#hands");
const rebuilt = await until(
  () => !document.querySelector("#hands [data-build]:not([data-built])"),
  undefined,
  60000,
);
const replayed = await titles();
const leftUnbuilt = await page.evaluate(() =>
  [...document.querySelectorAll("#hands [data-build]:not([data-built])")]
    .slice(0, 6)
    .map((el) => `${el.dataset.buildId ?? el.tagName}`),
);
await browser.close();

const marked = Object.entries(cards).filter(([, c]) => c.pcts.length > 1);
const finished = marked.filter(([, c]) => c.status === "done");
const short = finished.filter(([, c]) => c.pcts.at(-1) !== 100);
const stalled = marked.filter(([, c]) => c.status === "doing" && now - c.changedAt > STALL_MS);

const results = [
  ["agents marked progress on cards", marked.length > 0, `${marked.length} cards`],
  ["marked cards reached Completed", finished.length > 0, `${finished.length} cards`],
  [
    "every card moved at exactly 100%",
    short.length === 0,
    short.map(([id, c]) => `${id} at ${c.pcts.at(-1)}%`).join(", "),
  ],
  [
    "no card was left part way",
    stalled.length === 0,
    stalled.map(([id, c]) => `${id} stopped at ${c.pcts.at(-1)}%`).join(", "),
  ],
  [
    "agents added new tasks on the board",
    counts.all > 24 && counts.round > 0,
    `${counts.all} cards, ${counts.done} done, ${counts.round} from added pieces`,
  ],
  ["agents rewrote a note with new tasks", rewritten, ""],
  ["a rewritten note ends up whole", whole && looseNotes === 0, `${looseNotes} unbuilt`],
  ["notes keep their height", heightAfter === noteHeight, `${noteHeight} -> ${heightAfter}`],
  [
    "replay brings the original work back, built",
    replayed[0] === original && rebuilt,
    `${replayed[0]}, unbuilt: ${leftUnbuilt.join(" ") || "none"}`,
  ],
  ["no errors", errors.length === 0, errors.join(" | ")],
];

let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}
process.exit(failed ? 1 : 0);
