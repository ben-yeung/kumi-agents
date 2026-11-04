// Captures frames as a live work-log row appears, to check it eases open
// before an agent writes it.
// Usage: node e2e/livelog-frames.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/livelog/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (n) => new URL(n, out).pathname.slice(1);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base);
await page.getByRole("button", { name: "skip intro" }).click();
await page.evaluate(() => {
  const list = document.getElementById("worklog");
  window.scrollTo({
    top: list.getBoundingClientRect().bottom + scrollY - 700,
    behavior: "instant",
  });
});
await page.waitForFunction(() => document.querySelectorAll("#worklog > li").length > 8, null, {
  timeout: 60000,
  polling: 16,
});
const clip = await page.evaluate(() => {
  const r = document.getElementById("worklog").getBoundingClientRect();
  return {
    x: Math.max(0, r.left - 60),
    y: Math.max(0, r.bottom - 260),
    width: r.width + 160,
    height: 420,
  };
});
let last = 0;
for (const t of [0, 250, 500, 800, 1300, 2000, 3000, 4500]) {
  await page.waitForTimeout(t - last);
  last = t;
  await page.screenshot({ path: file(`row-${String(t).padStart(4, "0")}.png`), clip });
}
await browser.close();
console.log("saved");
