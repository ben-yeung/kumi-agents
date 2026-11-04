// Close-ups of the visitor's dart and hand pointers, light and dark.
// Usage: node e2e/pointer-shots.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/pointer/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (n) => new URL(n, out).pathname.slice(1);

const browser = await chromium.launch();
for (const colorScheme of ["light", "dark"]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    colorScheme,
    deviceScaleFactor: 2,
  });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor();
  const box = await page.locator('[data-build-id="hero.cta"]').boundingBox();
  const clip = { x: box.x - 40, y: box.y - 70, width: 520, height: 200 };
  await page.mouse.move(box.x + box.width + 150, box.y - 30);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: file(`${colorScheme}-dart.png`), clip });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: file(`${colorScheme}-hand.png`), clip });
  await page.close();
}
await browser.close();
console.log("saved");
