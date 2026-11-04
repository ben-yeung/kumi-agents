// Captures the hands section once built, at desktop, tablet and phone widths.
// Usage: node e2e/hands-shots.mjs http://localhost:<port>
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const out = new URL("./.shots/hands/", import.meta.url);
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
for (const [name, width, height] of [
  ["desktop", 1440, 900],
  ["tablet", 820, 1100],
  ["phone", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor();
  await page.evaluate(() =>
    document.getElementById("hands").scrollIntoView({ behavior: "instant" }),
  );
  await page.waitForTimeout(2500);
  const owners = await page.evaluate(
    () => document.querySelector("[data-swarm-crew]")?.textContent,
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#hands [data-build]:not([data-built])").length === 0,
    null,
    { timeout: 90000 },
  );
  const cols = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector("#hands ol")).gridTemplateColumns.split(" ").length,
  );
  const lanes = await page.locator("#hands ol > li").count();
  console.log(name, { lanes, cols, owners });
  await page.waitForTimeout(600);
  await page.locator("#hands").screenshot({ path: new URL(`${name}.png`, out).pathname.slice(1) });
  await page.close();
}
await browser.close();
