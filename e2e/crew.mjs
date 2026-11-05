// End-to-end checks of how the crew comes and goes, and who does what.
// - every work-log row is written by the agent named on it, at both widths
// - the hands counter changes and more than three agents appear while idle
// - agents return to move their own work along, on the notes and on the board
// - the crew menu lists who is here and what they are doing
// Usage: node e2e/crew.mjs http://localhost:<port> [seconds]
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const seconds = Number(process.argv[3] ?? 110);
const NAMES = ["ren", "sol", "ivo", "mika", "juno", "oki", "bea", "tao"];
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const browser = await chromium.launch();

async function settledPage(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
  return { page, errors };
}

/** Samples cursors in the page: who is on screen, and who is writing each row. */
async function watch(page) {
  await page.evaluate((names) => {
    window.__watch = { rows: [], counts: [], faces: [] };
    const nameOf = (el) => names.find((n) => el.textContent.trim().startsWith(n));
    setInterval(() => {
      const w = window.__watch;
      const count = document.querySelector("[data-swarm-crew]")?.textContent.match(/\d+/)?.[0];
      if (count && w.counts.at(-1) !== count) w.counts.push(count);
      const cursors = [...document.querySelectorAll("[data-swarm-agent]")];
      for (const c of cursors) {
        const n = nameOf(c);
        if (n && !w.faces.includes(n)) w.faces.push(n);
      }
      const writers = cursors.filter((c) => c.textContent.includes("logging")).map(nameOf);
      for (const row of document.querySelectorAll("#worklog > li[data-building]")) {
        if (w.rows.some((r) => r.id === row.dataset.buildId)) continue;
        const who = row.querySelector('[class*="who"]').textContent;
        const author = names.find((n) => who.includes(n));
        w.rows.push({ id: row.dataset.buildId, author, writers });
      }
    }, 16);
  }, NAMES);
}

const toLog = (page) =>
  page.evaluate(() => {
    const list = document.getElementById("worklog");
    const top = list.getBoundingClientRect().bottom + scrollY - 700;
    window.scrollTo({ top, behavior: "instant" });
  });

// 1 and 2. Authors and rotation, at both widths.
await Promise.all(
  [1440, 390].map(async (width) => {
    const { page, errors } = await settledPage(width);
    await watch(page);
    await toLog(page);
    const stop = Date.now() + seconds * 1000;
    while (Date.now() < stop) {
      await page.waitForTimeout(5000);
      await toLog(page);
    }
    const { rows, counts, faces } = await page.evaluate(() => window.__watch);
    const wrong = rows.filter((r) => !r.writers.includes(r.author));
    check(
      `${width}: every log row is written by its agent`,
      rows.length >= 8 && wrong.length === 0,
      `${rows.length} rows, wrong: ${wrong.map((r) => `${r.author} by ${r.writers}`).join("; ")}`,
    );
    check(`${width}: more than three agents appear`, faces.length > 3, faces.join(" "));
    check(`${width}: the counter moves`, new Set(counts).size > 1, counts.join(" "));
    const lately = counts.slice(-8).map(Number);
    check(`${width}: the page stays uncrowded`, Math.max(...lately) <= 4, lately.join(" "));
    check(`${width}: no errors`, errors.length === 0, errors.join(" | "));
    await page.close();
  }),
);

// Footer lines up with the floating pills at the end of the page.
for (const width of [1440, 2560]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
  await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect();
    const mid = (r) => r.top + r.height / 2;
    const foot = document.querySelector("footer");
    const mark = box(foot.querySelector("a, div > *"));
    const center = box(foot.querySelector("p").parentElement);
    const pill = box(document.querySelector("[data-swarm-crew]"));
    const bar = box(document.querySelector("[data-swarm-controls]"));
    return {
      offset: Math.abs(mid(center) - mid(pill)),
      markOffset: Math.abs(mid(mark) - mid(bar)),
      gap: mark.left - pill.right,
      pageCenter: Math.abs(center.left + center.width / 2 - document.body.clientWidth / 2),
    };
  });
  check(
    `${width}: footer lines up with the pills`,
    m.offset <= 1.5 && m.markOffset <= 1.5 && m.pageCenter <= 1.5 && m.gap > 0,
    JSON.stringify(m),
  );
  await page.close();
}

// 3. Notes move on by themselves, and the crew menu tells who is here.
{
  const { page, errors } = await settledPage(1440);
  const scrollToHands = () =>
    page.evaluate(() => document.querySelector("#hands ol").scrollIntoView({ block: "center" }));
  await scrollToHands();
  await page.waitForFunction(
    () => document.querySelectorAll("#hands [data-build]:not([data-built])").length === 0,
    null,
    { timeout: 90000 },
  );
  const pct = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-lane] span")]
        .map((s) => s.textContent)
        .filter((t) => t.endsWith("%"))
        .join(" "),
    );
  const before = await pct();
  await page.waitForFunction(
    (was) =>
      [...document.querySelectorAll("[data-lane] span")]
        .map((s) => s.textContent)
        .filter((t) => t.endsWith("%"))
        .join(" ") !== was,
    before,
    { timeout: 40000 },
  );
  check("notes update over time", true, `${before} -> ${await pct()}`);

  // While the notes are in view, agents are working on them, not standing about.
  const crewWords = await page.evaluate(async () => {
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      for (const el of document.querySelectorAll("[data-swarm-agent]")) {
        seen.add(el.textContent.trim().replace(/^\w+\W+/, ""));
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return [...seen];
  });
  // Tags type their words out, so only finished wording counts.
  const whole = crewWords.filter((w) => !crewWords.some((o) => o !== w && o.startsWith(w)));
  const heavy = whole.filter((w) => /review|proofread/.test(w));
  check("reviewing is not everyone's job", heavy.length <= 1, whole.join(", "));
  const passive = whole.filter((w) => /\b(rest|paus|wait|leav|stretch|tidy|pairing)/.test(w));
  check("no passive statuses", passive.length === 0, passive.join(", "));

  await page.locator("[data-swarm-crew]").hover();
  const menu = page.locator("#crew-menu li");
  await menu.first().waitFor();
  const rows = await menu.allTextContents();
  const count = Number(
    (await page.locator("[data-swarm-crew]").textContent()).match(/\d+/)?.[0] ?? -1,
  );
  check(
    "hovering the counter lists the crew",
    rows.length === count && rows.every((r) => NAMES.some((n) => r.startsWith(n))),
    rows.join(" | "),
  );
  await page.mouse.move(700, 300);
  await menu.first().waitFor({ state: "detached" });
  check("the crew menu closes", true);

  // 4. The board shows the same work, and an agent drags its own card across.
  await page.getByRole("button", { name: "board" }).click();
  const columns = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll("[data-column]")].map((c) => [
          c.dataset.column,
          [...c.querySelectorAll("[data-card]")].map((n) => n.dataset.card),
        ]),
      ),
    );
  const start = await columns();
  const size = (c) => Object.values(c).flat().length;
  check("the board holds every step", size(start) === 24, `${size(start)} cards`);

  await page.evaluate(() => {
    window.__drag = [];
    setInterval(() => {
      const carriers = [...document.querySelectorAll("[data-swarm-agent]")]
        .map((c) => c.textContent.trim())
        .filter((t) => /moving|picking/.test(t));
      for (const card of document.querySelectorAll('[class*="lifted"]')) {
        window.__drag.push({ author: card.getAttribute("data-agent"), carriers });
      }
    }, 30);
  });
  await page.evaluate(() =>
    document.querySelector("[data-column]").scrollIntoView({ block: "center" }),
  );
  const startDone = start.done.length;
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-column="done"] [data-card]').length > n,
    startDone,
    { timeout: 120000 },
  );
  const moved = await columns();
  const dragged = await page.evaluate(() => window.__drag);
  // Tags type their words out, so a sample can fall before the status shows.
  const stranger = dragged.filter(
    (d) => d.carriers.length && !d.carriers.some((c) => c.startsWith(d.author)),
  );
  check(
    "agents drag their own cards to Completed",
    moved.done.length > startDone && dragged.length > 0 && stranger.length === 0,
    `${startDone} -> ${moved.done.length} completed, top card ${moved.done[0]}, ` +
      `${dragged.length} samples, wrong: ${JSON.stringify(stranger.slice(0, 3))}`,
  );

  await page.getByRole("button", { name: "notes" }).click();
  const shown = await page.locator("[data-lane]").first().isVisible();
  const unbuilt = await page.locator("#hands [data-build]:not([data-built])").count();
  check("flipping back keeps the notes built", shown && unbuilt === 0, `${unbuilt} unbuilt`);
  check("no errors on the board", errors.length === 0, errors.join(" | "));
  await page.close();
}

await browser.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.detail}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
