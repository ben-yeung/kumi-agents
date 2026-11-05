// Screenshots for visual review, from the intro to the finished page, in e2e/.shots/.
// Run with: npm run e2e:shots
import { join } from "node:path";
import { buildWholePage, expect, replayButton, skipButton, test } from "./support";

const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1100 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "4k", width: 3840, height: 2160 },
];
const SCHEMES = ["light", "dark"] as const;
const BAR_HEIGHT = 90;

for (const colorScheme of SCHEMES) {
  for (const { name, width, height } of SIZES) {
    test.describe(`${colorScheme} ${name}`, () => {
      test.use({ colorScheme, viewport: { width, height } });

      test("the page, from intro to finished", async ({ page }) => {
        const file = (shot: string) => join("e2e", ".shots", `${colorScheme}-${name}-${shot}.png`);
        const bar = { x: 0, y: height - BAR_HEIGHT, width, height: BAR_HEIGHT };

        await page.goto("/");
        await page.locator("[data-swarm-controls]").waitFor();
        await page.waitForTimeout(800);
        await page.screenshot({ path: file("intro") });
        await page.screenshot({ path: file("bars-intro"), clip: bar });

        await skipButton(page).click();
        await replayButton(page).waitFor({ timeout: 40_000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: file("fold") });
        await page.screenshot({ path: file("bars-settled"), clip: bar });

        await buildWholePage(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: file("footer") });
        await page.locator("#method").screenshot({ path: file("method") });
        await page.locator("#hands").screenshot({ path: file("notes") });

        // From the top, or the pinned nav lands in the middle of the capture.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: file("full"), fullPage: true });

        await page.evaluate(() => document.getElementById("hands")!.scrollIntoView());
        await page.getByRole("button", { name: "board" }).click();
        await page.waitForTimeout(500);
        await page.locator("#hands").screenshot({ path: file("board") });

        await page.locator("[data-swarm-crew]").hover();
        await page.waitForTimeout(350);
        await page.screenshot({ path: file("menu") });

        await page.getByRole("button", { name: "Show actions in cursor tags" }).click();
        await page.mouse.move(10, 10);
        await page.waitForTimeout(400);
        await page.screenshot({ path: file("bars-names"), clip: bar });

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow).toBe(0);
      });
    });
  }
}
