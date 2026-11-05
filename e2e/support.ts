import { test as base, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __build: { first: Record<string, number>; done: Record<string, number> };
    __drag: { author: string | null; carriers: string[] }[];
    __early: Set<string>;
    __samples: Sample[];
    __watch: {
      rows: { id: string; author?: string; writers: (string | undefined)[] }[];
      counts: string[];
      faces: string[];
    };
  }
}

/** One observation of one agent's cursor. */
export type Sample = {
  t: number;
  name: string;
  action: string;
  x: number;
  y: number;
  settled: boolean;
};

export const NAMES = ["ren", "sol", "ivo", "mika", "juno", "oki", "bea", "tao"];

/** Every test fails on an uncaught exception or a console error in the page. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const errors = watchErrors(page);
    await provide(page);
    expect(errors, "page and console errors").toEqual([]);
  },
});

export { expect };

export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

export const replayButton = (page: Page) => page.getByRole("button", { name: "replay" });
export const skipButton = (page: Page) => page.getByRole("button", { name: "skip intro" });

/** How long the hero takes to settle from now. */
export async function heroSettledMs(page: Page) {
  const t0 = Date.now();
  await replayButton(page).waitFor({ timeout: 40_000 });
  return Date.now() - t0;
}

/** Opens the page and skips straight to the settled hero. */
export async function settle(page: Page) {
  await page.goto("/");
  await skipButton(page).click();
  await replayButton(page).waitFor({ timeout: 40_000 });
}

export const unbuiltCount = (page: Page, scope = "") =>
  page.locator(`${scope} [data-build]:not([data-built])`).count();

/** Waits for the crew to finish a section that is already in view. */
export async function sectionBuilt(page: Page, id: string, timeout = 90_000) {
  await page.waitForFunction(
    (s) => document.querySelectorAll(`#${s} [data-build]:not([data-built])`).length === 0,
    id,
    { timeout },
  );
}

/** Stays at the bottom of the page until the crew has built all of it. */
export async function buildWholePage(page: Page) {
  await expect(async () => {
    await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
    expect(await unbuiltCount(page)).toBe(0);
  }).toPass({ timeout: 120_000, intervals: [500] });
}
