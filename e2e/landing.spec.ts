// Landing somewhere other than the top: the section in view builds first, then
// the crew works back up the page, the hero last. Whatever the visitor scrolls
// to takes priority.
import type { Page } from "@playwright/test";
import { expect, replayButton, settle, skipButton, test } from "./support";

/** Records the moment each section first has work built, and finishes. */
const track = () => {
  window.__build = { first: {}, done: {} };
  const t0 = performance.now();
  setInterval(() => {
    if (!document.documentElement.hasAttribute("data-swarm")) return;
    // The pinned header shares the hero's name but goes up first, by design.
    for (const s of document.querySelectorAll<HTMLElement>("[data-build-section]:not(header)")) {
      const name = s.dataset.buildSection!;
      const all = s.querySelectorAll("[data-build]");
      const built = s.querySelectorAll("[data-build][data-built]").length;
      const t = Math.round(performance.now() - t0);
      if (built > 0 && !(name in window.__build.first)) window.__build.first[name] = t;
      if (built === all.length && built > 0 && !(name in window.__build.done)) {
        window.__build.done[name] = t;
      }
    }
  }, 50);
};

const built = (page: Page) => page.evaluate(() => window.__build);

/** Everything from the top of the page down to where the visit is. Lower sections wait. */
const UNBUILT = ["hero", "hands", "method", "log"]
  .flatMap((name) => [
    `[data-build-section="${name}"] [data-build]:not([data-built])`,
    `[data-build-section="${name}"][data-build]:not([data-built])`,
  ])
  .join(", ");

async function allBuilt(page: Page) {
  try {
    await page.waitForFunction((s) => !document.querySelector(s), UNBUILT, { timeout: 120_000 });
  } catch (err) {
    const stuck = await page
      .locator(UNBUILT)
      .evaluateAll((els) =>
        (els as HTMLElement[]).map((el) => `${el.dataset.buildId} ${el.dataset.buildLabel}`),
      );
    const crew = await page.locator("[data-swarm-crew]").textContent();
    throw new Error(`stuck on ${stuck.join(", ")} with ${crew}`, { cause: err });
  }
}

const VISITS: [string, (page: Page) => Promise<unknown>][] = [
  ["a hash link", (page) => page.goto("/#log")],
  [
    "a reload mid-page",
    async (page) => {
      await page.goto("/#log");
      await page.waitForTimeout(800);
      await page.reload();
    },
  ],
];

for (const [name, arrive] of VISITS) {
  test(`${name} builds the section in view, then works back up`, async ({ page }) => {
    await page.addInitScript(track);
    await arrive(page);
    await page.waitForTimeout(1200);
    const y = await page.evaluate(() => Math.round(scrollY));
    const logLeft = await page
      .locator('[data-build-section="log"] [data-build]:not([data-built])')
      .count();
    await allBuilt(page);
    const { first, done } = await built(page);

    expect(y, "opens at the section").toBeGreaterThan(500);
    expect(logLeft, "work has started right away").toBeLessThan(20);
    expect(done.log, "the viewed section finishes first").toBeLessThan(
      Math.min(first.method, first.hands, first.hero),
    );
    expect(first.method, "method before hands").toBeLessThan(first.hands);
    expect(first.hands, "hands before hero").toBeLessThan(first.hero);
    await expect(replayButton(page)).toHaveCount(1);
  });
}

test("scrolling up pulls that section to the front", async ({ page }) => {
  await page.addInitScript(track);
  await page.goto("/#waitlist");
  await page.waitForFunction(() => document.querySelector("#waitlist [data-built]"));
  await page.evaluate(() =>
    document.getElementById("hands")!.scrollIntoView({ behavior: "instant" }),
  );
  await allBuilt(page);
  const { first, done } = await built(page);
  expect(done.hands).toBeLessThan(first.hero);
  expect(first.hands).toBeLessThan(first.method ?? Infinity);
});

test("sections jumped past still get built", async ({ page }) => {
  await settle(page);
  await page.evaluate(() =>
    document.getElementById("log")!.scrollIntoView({ behavior: "instant" }),
  );
  await allBuilt(page);
});

test("scrolling up to the hero brings it forward", async ({ page }) => {
  await page.addInitScript(track);
  await page.goto("/#log");
  await page.waitForFunction(() => document.querySelector("#log [data-built]"));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(
    () => document.querySelector('section[data-build-section="hero"] [data-built]'),
    null,
    { timeout: 30_000 },
  );
  const { first } = await built(page);
  expect(first).not.toHaveProperty("hands");
  expect(first).not.toHaveProperty("method");
});

test("nothing in the footer shows before an agent has put it there", async ({ page }) => {
  await page.addInitScript(() => {
    window.__early = new Set();
    setInterval(() => {
      if (!document.documentElement.hasAttribute("data-swarm")) return;
      const parts = document.querySelectorAll('footer svg, footer [class*="word"], footer p');
      for (const el of parts) {
        const unbuilt = !el.closest("[data-build]")?.hasAttribute("data-built");
        const shown = !el.closest("[data-build]") || getComputedStyle(el).opacity !== "0";
        if (unbuilt && shown && !el.closest("[data-building]")) {
          window.__early.add(el.textContent!.trim() || el.tagName);
        }
      }
    }, 30);
  });
  await page.goto("/#waitlist");
  await page.waitForFunction(
    () =>
      document.querySelector("footer [data-built]") &&
      !document.querySelector("footer [data-build]:not([data-built])"),
    null,
    { timeout: 60_000 },
  );
  expect(await page.evaluate(() => [...window.__early])).toEqual([]);
});

test("loading at the top still plays the intro", async ({ page }) => {
  await page.goto("/");
  await skipButton(page).waitFor({ timeout: 8000 });
});
