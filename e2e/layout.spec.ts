// Layout at the widths that matter. The reduced-motion page is the finished page,
// available at once, so these need not wait for the crew.
import { expect, settle, test } from "./support";

const WIDTHS = [
  { width: 390, height: 844, columns: 1 },
  { width: 820, height: 1100, columns: 2 },
  { width: 1440, height: 900, columns: 4 },
  { width: 3840, height: 2160, columns: 4 },
];

test.describe("finished page", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  for (const { width, height, columns } of WIDTHS) {
    test(`${width}px: nothing overflows, and the notes fit`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const overflow = () =>
        page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(await overflow(), "notes").toBe(0);
      const shown = await page.evaluate(
        () =>
          getComputedStyle(document.querySelector("#hands ol")!).gridTemplateColumns.split(" ")
            .length,
      );
      expect(shown).toBe(columns);
      await expect(page.locator("#hands ol > li")).toHaveCount(8);

      await page.getByRole("button", { name: "board" }).click();
      expect(await overflow(), "board").toBe(0);
    });
  }
});

for (const { width, height } of [WIDTHS[0], WIDTHS[2]]) {
  test(`${width}px: the crew pill and the button bar keep apart`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await settle(page);
    await page.getByRole("button", { name: "Show actions in cursor tags" }).click();
    const crew = await page.locator("[data-swarm-crew]").boundingBox();
    const bar = await page.locator("[data-swarm-controls]").boundingBox();
    expect(crew!.x + crew!.width).toBeLessThan(bar!.x);
  });
}

for (const width of [1440, 2560]) {
  test(`${width}px: the footer lines up with the pills`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
    // Twice, in case the page grew under the first jump.
    await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect();
      const mid = (r: DOMRect) => r.top + r.height / 2;
      const foot = document.querySelector("footer")!;
      const mark = box(foot.querySelector("a, div > *")!);
      const center = box(foot.querySelector("p")!.parentElement!);
      const pill = box(document.querySelector("[data-swarm-crew]")!);
      const bar = box(document.querySelector("[data-swarm-controls]")!);
      return {
        offset: Math.abs(mid(center) - mid(pill)),
        markOffset: Math.abs(mid(mark) - mid(bar)),
        gap: mark.left - pill.right,
        pageCenter: Math.abs(center.left + center.width / 2 - document.body.clientWidth / 2),
      };
    });
    expect(m.offset).toBeLessThanOrEqual(1.5);
    expect(m.markOffset).toBeLessThanOrEqual(1.5);
    expect(m.pageCenter).toBeLessThanOrEqual(1.5);
    expect(m.gap).toBeGreaterThan(0);
  });
}
