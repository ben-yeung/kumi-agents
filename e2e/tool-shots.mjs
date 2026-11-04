// Records which pointer tools the agents use during the intro and captures a frame of each.
// Usage: node e2e/tool-shots.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/tools/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base);
const seen = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 12000) {
  const tools = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-hidden="true"] svg[class*="Pointer"]')].map(
      (s) => s.getAttribute("class").match(/Pointer-module__\w+__(\w+)/)?.[1],
    ),
  );
  for (const tool of tools) {
    if (tool && !seen.has(tool)) {
      seen.add(tool);
      await page.screenshot({ path: new URL(`${tool}.png`, out).pathname.slice(1) });
    }
  }
  await page.waitForTimeout(60);
}
console.log(JSON.stringify({ seen: [...seen], errors }));
await browser.close();
