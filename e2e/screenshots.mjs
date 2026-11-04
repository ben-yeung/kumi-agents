// Captures full-page screenshots across viewports and themes for visual review.
// Usage: node e2e/screenshots.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/", import.meta.url);
await mkdir(out, { recursive: true });

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "4k", width: 3840, height: 2160 },
];

const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: scheme,
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.mouse.move(vp.width * 0.3, vp.height * 0.35);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: new URL(`${scheme}-${vp.name}-fold.png`, out).pathname.slice(1),
    });
    await page.screenshot({
      path: new URL(`${scheme}-${vp.name}-full.png`, out).pathname.slice(1),
      fullPage: true,
    });
    await page.close();
  }
}
await browser.close();
console.log("saved to", out.pathname);
