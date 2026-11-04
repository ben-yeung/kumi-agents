// Zoomed crops of every pill with a center guide line, for judging vertical
// alignment by eye (fonts sit differently, so no single metric settles it).
// Usage: node e2e/pill-zoom.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/pills/", import.meta.url);
await mkdir(out, { recursive: true });
const pills = {
  nav: 'header a[href="#waitlist"]',
  cta: 'section#top a[href="#waitlist"]',
  bar: "[data-swarm-controls]",
  crew: "[data-swarm-crew]",
};
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 4,
});
await page.goto(base);
await page.getByRole("button", { name: "skip intro" }).click();
await page.getByRole("button", { name: "replay" }).waitFor();
await page.mouse.move(700, 450);
const guide =
  "linear-gradient(transparent calc(50% - .25px), #e0457b calc(50% - .25px), #e0457b calc(50% + .25px), transparent calc(50% + .25px))";
await page.addStyleTag({
  content: `[class*="overlay"] { visibility: hidden !important; }
    ${pills.nav}, ${pills.cta}, [data-swarm-controls] button, ${pills.crew} { background-image: ${guide} !important; }`,
});
await page.waitForTimeout(500);
for (const [name, selector] of Object.entries(pills)) {
  await page.locator(selector).screenshot({ path: new URL(`${name}.png`, out).pathname.slice(1) });
}
await browser.close();
console.log("saved");
