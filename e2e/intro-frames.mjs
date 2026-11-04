// Captures frames of the intro and the scroll-driven build, plus console errors.
// Usage: node e2e/intro-frames.mjs http://localhost:<port> [light|dark] [width] [height]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const [base = "http://localhost:3000", scheme = "light", w = "1440", h = "900"] =
  process.argv.slice(2);
const out = new URL("./.shots/frames/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (name) => new URL(name, out).pathname.slice(1);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  colorScheme: scheme,
});
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(base, { waitUntil: "domcontentloaded" });
const start = Date.now();
for (const t of [300, 900, 1600, 2400, 3300, 4500, 6500]) {
  await page.waitForTimeout(Math.max(0, t - (Date.now() - start)));
  await page.screenshot({ path: file(`${scheme}-intro-${String(t).padStart(4, "0")}.png`) });
}
const choreo = await page.evaluate(() => sessionStorage.getItem("kumi-last-choreo"));

for (const [i, y] of [900, 1900, 2900, 4000].entries()) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: file(`${scheme}-scroll-${i}a.png`) });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: file(`${scheme}-scroll-${i}b.png`) });
}
const unbuilt = await page.evaluate(() =>
  [...document.querySelectorAll("[data-build]:not([data-built])")].map((e) => e.dataset.buildId),
);
console.log(JSON.stringify({ choreo, unbuilt, errors }, null, 2));
await browser.close();
