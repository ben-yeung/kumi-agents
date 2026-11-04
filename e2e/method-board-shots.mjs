// Captures the method strand, the board and the crew menu at phone, laptop and
// 4K widths, in both themes.
// Usage: node e2e/method-board-shots.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/method-board/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (n) => new URL(n, out).pathname.slice(1);

const browser = await chromium.launch();
for (const [name, width, height, scheme] of [
  ["phone", 390, 844, "light"],
  ["laptop", 1440, 900, "light"],
  ["laptop-dark", 1440, 900, "dark"],
  ["4k", 3840, 2160, "light"],
]) {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor();
  for (const id of ["hands", "method"]) {
    await page.evaluate((s) => document.getElementById(s).scrollIntoView(), id);
    await page.waitForFunction(
      (s) => document.querySelectorAll(`#${s} [data-build]:not([data-built])`).length === 0,
      id,
      { timeout: 120000 },
    );
  }
  await page.waitForTimeout(800);
  await page.locator("#method").screenshot({ path: file(`${name}-method.png`) });

  await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
  await page.waitForFunction(
    () => document.querySelectorAll("footer [data-build]:not([data-built])").length === 0,
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => window.scrollTo({ top: 1e6, behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: file(`${name}-footer.png`) });

  await page.evaluate(() => document.getElementById("hands").scrollIntoView());
  await page.getByRole("button", { name: "board" }).click();
  await page.waitForTimeout(500);
  await page.locator("#hands").screenshot({ path: file(`${name}-board.png`) });
  await page.locator("[data-swarm-crew]").hover();
  await page.waitForTimeout(350);
  await page.screenshot({ path: file(`${name}-menu.png`) });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  console.log(name, { overflow });
  await page.close();
}
await browser.close();
