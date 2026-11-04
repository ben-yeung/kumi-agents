// End-to-end checks of the intro behaviors in a real browser.
// Usage: node e2e/behaviors.mjs http://localhost:<port>
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

async function heroSettledMs(page) {
  const t0 = Date.now();
  await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
  return Date.now() - t0;
}

// 1. Every visit plays the full intro at the same tempo; a reload picks a different choreography.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  const fullMs = await heroSettledMs(page);
  const first = await page.evaluate(() => sessionStorage.getItem("kumi-last-choreo"));
  await page.reload();
  const shortMs = await heroSettledMs(page);
  const second = await page.evaluate(() => sessionStorage.getItem("kumi-last-choreo"));
  check("intro settles at a calm pace", fullMs > 6000 && fullMs < 20000, `${fullMs}ms (${first})`);
  check("reload keeps the same weight", shortMs > fullMs * 0.6, `${shortMs}ms (${second})`);
  check("reload picks a different choreography", first !== second, `${first} -> ${second}`);

  // Replay rebuilds the hero.
  await page.getByRole("button", { name: "replay" }).click();
  await page.getByRole("button", { name: "skip intro" }).waitFor();
  const replayMs = await heroSettledMs(page);
  check("replay plays again", replayMs > 1500, `${replayMs}ms`);

  // Live log grows once the log section is built and in view.
  await page.evaluate(() => document.getElementById("log").scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(24000);
  const rows = await page.locator("#worklog > li").count();
  check("work log grows live", rows > 8, `${rows} rows`);

  // Hands head off to other work once everything is settled; a few stay, in rotation.
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
  );
  await page.waitForTimeout(60000);
  const label = await page.locator("[data-swarm-crew]").textContent();
  check("crew thins when settled", Number(label.match(/(\d+) hands?/)?.[1]) <= 6, label);
  const unbuilt = await page.locator("[data-build]:not([data-built])").count();
  check("everything built", unbuilt === 0, `${unbuilt} unbuilt`);

  // Replay unsets the whole page, then scrolling builds it again.
  await page.getByRole("button", { name: "replay" }).click();
  await page.getByRole("button", { name: "skip intro" }).waitFor();
  const reset = await page.evaluate(() => ({
    y: window.scrollY,
    hands: document.querySelectorAll("#hands [data-built]").length,
    rows: document.querySelectorAll("#worklog > li").length,
    split: document.querySelectorAll("#hero-title span:not(em)").length,
  }));
  check(
    "replay resets the page",
    reset.y === 0 && reset.hands === 0 && reset.rows === 8,
    JSON.stringify(reset),
  );
  await heroSettledMs(page);
  await page.evaluate(() =>
    document.getElementById("hands").scrollIntoView({ behavior: "instant" }),
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#hands [data-build]:not([data-built])").length === 0,
    null,
    { timeout: 40000 },
  );
  check("replayed sections rebuild on scroll", true);
  check("no page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 2. Skip finishes the hero immediately.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  const t0 = Date.now();
  await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 3000 });
  const hero = await page
    .locator('[data-build-section="hero"] [data-build]:not([data-built])')
    .count();
  check("skip finishes the hero", hero === 0, `${Date.now() - t0}ms, ${hero} left`);
  await page.close();
}

// 3. Reduced motion shows the finished page with no crew.
const symmetry = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await symmetry.goto(base);
await symmetry.locator("[data-swarm-controls]").waitFor();
{
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await page.goto(base);
  await page.waitForTimeout(800);
  const swarm = await page.evaluate(() => document.documentElement.getAttribute("data-swarm"));
  const opacity = await page.locator("#hero-title").evaluate((el) => getComputedStyle(el).opacity);
  const agents = await page.locator("[data-swarm-controls]").count();
  check("reduced motion: no swarm", swarm === null && agents === 0, `swarm=${swarm}`);
  check("reduced motion: content visible", opacity === "1", `opacity=${opacity}`);
  const [tagBox, replayBox] = await Promise.all([
    symmetry.locator("[data-swarm-controls] button").nth(0).boundingBox(),
    symmetry.locator("[data-swarm-controls] button").nth(1).boundingBox(),
  ]);
  check(
    "bar buttons are symmetrical",
    tagBox.width === replayBox.width && tagBox.height === replayBox.height,
    `${tagBox.width}x${tagBox.height} / ${replayBox.width}x${replayBox.height}`,
  );
  await symmetry.close();
  check(
    "reduced motion: tag setting stays reachable",
    (await page.getByRole("button", { name: "Show actions in cursor tags" }).count()) === 1,
  );

  // Hover statuses are short, and no two elements say the same thing.
  const intents = await page.evaluate(() =>
    [...document.querySelectorAll("[data-intent], [data-intent-press]")].flatMap((el) =>
      [el.dataset.intent, el.dataset.intentPress].filter(Boolean),
    ),
  );
  const repeats = intents.filter((t, i) => intents.indexOf(t) !== i);
  const long = intents.filter((t) => t.length > 16);
  check("hover statuses are unique", repeats.length === 0, repeats.join(", "));
  check(
    "hover statuses are short",
    long.length === 0,
    `${intents.length} total ${long.join(", ")}`,
  );
  await page.close();
}

await browser.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.detail}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
