// Captures the bottom corners: crew pill left, button bar right, in both tag modes.
// Usage: node e2e/bars-shots.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/bars/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (n) => new URL(n, out).pathname.slice(1);
const browser = await chromium.launch();
for (const [name, width, height] of [
  ["desktop", 1440, 900],
  ["phone", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(base);
  await page.locator("[data-swarm-controls]").waitFor();
  await page.waitForTimeout(800);
  const clip = { x: 0, y: height - 90, width, height: 90 };
  await page.screenshot({ path: file(`${name}-intro.png`), clip });
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: file(`${name}-settled.png`), clip });
  const tag = page.getByRole("button", { name: "Show actions in cursor tags" });
  await tag.click();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file(`${name}-names.png`), clip });
  const boxes = await page.evaluate(() => {
    const r = (s) => {
      const b = document.querySelector(s).getBoundingClientRect();
      return [Math.round(b.left), Math.round(b.right)];
    };
    return { crew: r("[data-swarm-crew]"), bar: r("[data-swarm-controls]") };
  });
  console.log(name, boxes, boxes.crew[1] < boxes.bar[0] ? "no overlap" : "OVERLAP");
  await page.close();
}
await browser.close();
