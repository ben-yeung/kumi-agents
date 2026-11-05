// How the crew comes and goes, and who does what.
import type { Page } from "@playwright/test";
import { expect, NAMES, sectionBuilt, settle, test } from "./support";

/** The most any visit needs to show a log's worth of rows and a change of crew. */
const WATCH_MS = 110_000;
const PASSIVE = /\b(rest|paus|wait|leav|stretch|tidy|pairing)/;

/** Samples cursors in the page: who is on screen, and who is writing each row. */
async function watch(page: Page) {
  await page.evaluate((names) => {
    window.__watch = { rows: [], counts: [], faces: [] };
    const nameOf = (el: Element) => names.find((n) => el.textContent!.trim().startsWith(n));
    setInterval(() => {
      const w = window.__watch;
      const count = document.querySelector("[data-swarm-crew]")?.textContent?.match(/\d+/)?.[0];
      if (count && w.counts.at(-1) !== count) w.counts.push(count);
      const cursors = [...document.querySelectorAll("[data-swarm-agent]")];
      for (const c of cursors) {
        const n = nameOf(c);
        if (n && !w.faces.includes(n)) w.faces.push(n);
      }
      const writers = cursors.filter((c) => c.textContent!.includes("logging")).map(nameOf);
      for (const row of document.querySelectorAll<HTMLElement>("#worklog > li[data-building]")) {
        if (w.rows.some((r) => r.id === row.dataset.buildId)) continue;
        const who = row.querySelector('[class*="who"]')!.textContent!;
        w.rows.push({
          id: row.dataset.buildId!,
          author: names.find((n) => who.includes(n)),
          writers,
        });
      }
    }, 16);
  }, NAMES);
}

const toLog = (page: Page) =>
  page.evaluate(() => {
    const top = document.getElementById("worklog")!.getBoundingClientRect().bottom + scrollY - 700;
    window.scrollTo({ top, behavior: "instant" });
  });

const crewHasShown = ({ rows, counts, faces }: Window["__watch"]) =>
  rows.length >= 8 &&
  faces.length > 3 &&
  new Set(counts).size > 1 &&
  Math.max(...counts.slice(-8).map(Number)) <= 4;

for (const width of [1440, 390]) {
  test(`${width}px: agents write their own rows, and the crew rotates`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    await watch(page);
    const stop = Date.now() + WATCH_MS;
    do {
      await toLog(page);
      await page.waitForTimeout(1000);
    } while (Date.now() < stop && !crewHasShown(await page.evaluate(() => window.__watch)));

    const { rows, counts, faces } = await page.evaluate(() => window.__watch);
    expect(rows.length, "rows written").toBeGreaterThanOrEqual(8);
    expect(rows.filter((r) => !r.writers.includes(r.author))).toEqual([]);
    expect(faces.length, `agents seen: ${faces}`).toBeGreaterThan(3);
    expect(new Set(counts).size, `counter: ${counts}`).toBeGreaterThan(1);
    const lately = counts.slice(-8).map(Number);
    expect(Math.max(...lately), `counter: ${counts}`).toBeLessThanOrEqual(4);
  });
}

async function handsInView(page: Page) {
  await settle(page);
  await page.evaluate(() =>
    document.querySelector("#hands ol")!.scrollIntoView({ block: "center" }),
  );
  await sectionBuilt(page, "hands");
}

test("notes move on by themselves, with agents working on them", async ({ page }) => {
  await handsInView(page);
  const progress = async () => {
    const texts = await page.locator("[data-lane] span").allTextContents();
    return texts.filter((t) => t.endsWith("%")).join(" ");
  };
  const before = await progress();
  await expect.poll(progress, { timeout: 40_000 }).not.toBe(before);

  const crewWords = await page.evaluate(async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      for (const el of document.querySelectorAll("[data-swarm-agent]")) {
        seen.add(el.textContent!.trim().replace(/^\w+\W+/, ""));
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return [...seen];
  });
  // Tags type their words out, so only finished wording counts.
  const whole = crewWords.filter((w) => !crewWords.some((o) => o !== w && o.startsWith(w)));
  // A departure can be cut off mid-word, and says where an agent is going, not what it does here.
  const chores = whole.filter((w) => !w.startsWith("off to"));
  expect(chores.filter((w) => /review|proofread/.test(w)).length, chores.join(", ")).toBeLessThan(
    2,
  );
  expect(whole.filter((w) => PASSIVE.test(w))).toEqual([]);
});

test("the crew menu tells who is here", async ({ page }) => {
  await settle(page);
  await page.locator("[data-swarm-crew]").hover();
  const menu = page.locator("#crew-menu li");
  await menu.first().waitFor();
  const rows = await menu.allTextContents();
  const label = await page.locator("[data-swarm-crew]").textContent();
  expect(rows.length).toBe(Number(label!.match(/\d+/)?.[0]));
  expect(rows.filter((r) => !NAMES.some((n) => r.startsWith(n)))).toEqual([]);

  await page.mouse.move(700, 300);
  await menu.first().waitFor({ state: "detached" });
});

test("the board holds the same work, and agents drag their own cards", async ({ page }) => {
  test.setTimeout(240_000);
  await handsInView(page);
  await page.getByRole("button", { name: "board" }).click();
  const columns = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>("[data-column]")].map((c) => [
          c.dataset.column,
          [...c.querySelectorAll<HTMLElement>("[data-card]")].map((n) => n.dataset.card),
        ]),
      ),
    );
  const start = await columns();
  // Agents may already have added tasks of their own by now.
  expect(Object.values(start).flat().length).toBeGreaterThanOrEqual(24);

  await page.evaluate(() => {
    window.__drag = [];
    setInterval(() => {
      const carriers = [...document.querySelectorAll("[data-swarm-agent]")]
        .map((c) => c.textContent!.trim())
        .filter((t) => /moving|picking/.test(t));
      for (const card of document.querySelectorAll('[class*="lifted"]')) {
        window.__drag.push({ author: card.getAttribute("data-agent"), carriers });
      }
    }, 30);
  });
  await page.evaluate(() =>
    document.querySelector("[data-column]")!.scrollIntoView({ block: "center" }),
  );
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-column="done"] [data-card]').length > n,
    start.done.length,
    { timeout: 120_000 },
  );
  const dragged = await page.evaluate(() => window.__drag);
  expect(dragged.length, "drag samples").toBeGreaterThan(0);
  // Tags type their words out, so a sample can fall before the status shows.
  expect(
    dragged.filter((d) => d.carriers.length && !d.carriers.some((c) => c.startsWith(d.author!))),
  ).toEqual([]);

  await page.getByRole("button", { name: "notes" }).click();
  await expect(page.locator("[data-lane]").first()).toBeVisible();
  await expect(page.locator("#hands [data-build]:not([data-built])")).toHaveCount(0);
});
