// How the agents' work moves along: marking progress on the board takes a card
// to 100% and on to Completed, finished agents add new tasks on the board and the
// notes, and replay brings back the original work.
import type { Page } from "@playwright/test";
import { expect, replayButton, settle, skipButton, test } from "./support";

/** How long a marked card may sit still before it counts as left unfinished. */
const STALL_MS = 3500;
const ADDED_CARD = '[data-card*="-1-"]';

type Card = { first?: string; status?: string; pcts: number[]; changedAt: number };

declare global {
  interface Window {
    __cards: Record<string, Card>;
    __now: number;
  }
}

const titles = (page: Page) => page.locator("[data-lane] h3").allTextContents();
const scrollTo = (page: Page, selector: string) =>
  page.evaluate((s) => document.querySelector(s)!.scrollIntoView({ block: "center" }), selector);

test("cards finish at 100%, agents add tasks, and replay starts over", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await settle(page);
  await page.getByRole("button", { name: "board" }).click();
  await scrollTo(page, "[data-column]");

  await page.evaluate(() => {
    window.__cards = {};
    setInterval(() => {
      const now = performance.now();
      for (const el of document.querySelectorAll<HTMLElement>("[data-card]")) {
        const c = (window.__cards[el.dataset.card!] ??= {
          first: el.dataset.status,
          pcts: [],
          changedAt: 0,
        });
        c.status = el.dataset.status;
        if (el.dataset.status !== "doing") continue;
        const pct = Number(el.textContent!.match(/(\d+)%/)?.[1]);
        if (c.pcts.at(-1) === pct) continue;
        if (c.pcts.length) c.changedAt = now;
        c.pcts.push(pct);
      }
      window.__now = now;
    }, 40);
  });

  // An agent only adds a piece once its own are done, so everything below has happened by now.
  await page.waitForSelector(ADDED_CARD, { state: "attached", timeout: 180_000 });
  const { cards, now } = await page.evaluate(() => ({ cards: window.__cards, now: window.__now }));
  const counts = await page.evaluate(() => ({
    all: document.querySelectorAll("[data-card]").length,
    added: document.querySelectorAll('[data-card*="-1-"], [data-card*="-2-"]').length,
  }));

  const marked = Object.entries(cards).filter(([, c]) => c.pcts.length > 1);
  const finished = marked.filter(([, c]) => c.status === "done");
  expect(marked.length, "cards marked").toBeGreaterThan(0);
  expect(finished.length, "marked cards completed").toBeGreaterThan(0);
  expect(finished.filter(([, c]) => c.pcts.at(-1) !== 100)).toEqual([]);
  expect(marked.filter(([, c]) => c.status === "doing" && now - c.changedAt > STALL_MS)).toEqual(
    [],
  );
  expect(counts.all, "cards on the board").toBeGreaterThan(24);
  expect(counts.added, "cards from added pieces").toBeGreaterThan(0);

  // The notes: a finished agent rewrites their note in place.
  await page.getByRole("button", { name: "notes" }).click();
  await scrollTo(page, "[data-lane]");
  const noteHeight = () =>
    page.evaluate(() => document.querySelector("[data-lane]")!.getBoundingClientRect().height);
  const before = await titles(page);
  const height = await noteHeight();
  await page.waitForFunction(
    (old) =>
      [...document.querySelectorAll("[data-lane] h3")].some((h, i) => h.textContent !== old[i]),
    before,
    { timeout: 90_000 },
  );
  // Another agent can be writing by now, so wait for a moment when no note is.
  await page.waitForFunction(() => !document.querySelector("[data-lane] [data-unwritten]"), null, {
    timeout: 90_000,
  });
  await expect(page.locator("#hands [data-build]:not([data-built])")).toHaveCount(0);
  expect(await noteHeight(), "notes keep their height").toBe(height);

  // Replay starts everything over, then the crew builds it again.
  await replayButton(page).click();
  await skipButton(page).click();
  await replayButton(page).waitFor({ timeout: 40_000 });
  await scrollTo(page, "#hands");
  await page.waitForFunction(
    () => !document.querySelector("#hands [data-build]:not([data-built])"),
    null,
    { timeout: 60_000 },
  );
  expect((await titles(page))[0]).toBe("Choose a payments provider");
});
