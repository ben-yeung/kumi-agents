// Landing somewhere other than the top: the section in view builds first, then
// the crew works back up the page, the hero last. Whatever the visitor scrolls
// to takes priority.
// Usage: node e2e/landing.mjs http://localhost:<port>
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const browser = await chromium.launch();

/** Records the moment each section first has work built, and finishes. */
const track = () => {
  window.__build = { first: {}, done: {} };
  const t0 = performance.now();
  setInterval(() => {
    const swarm = document.documentElement.hasAttribute("data-swarm");
    if (!swarm) return;
    // The pinned header shares the hero's name but goes up first, by design.
    for (const s of document.querySelectorAll("[data-build-section]:not(header)")) {
      const name = s.dataset.buildSection;
      const all = s.querySelectorAll("[data-build]");
      const built = s.querySelectorAll("[data-build][data-built]").length;
      const t = Math.round(performance.now() - t0);
      if (built > 0 && !(name in window.__build.first)) window.__build.first[name] = t;
      if (built === all.length && built > 0 && !(name in window.__build.done)) {
        window.__build.done[name] = t;
      }
    }
  }, 50);
};

/** Everything from the top of the page down to where the visit is. Lower sections wait. */
async function allBuilt(page, timeout = 120000) {
  const left = () =>
    ["hero", "hands", "method", "log"].flatMap((name) => [
      ...document.querySelectorAll(
        `[data-build-section="${name}"] [data-build]:not([data-built]), ` +
          `[data-build-section="${name}"][data-build]:not([data-built])`,
      ),
    ]);
  try {
    await page.waitForFunction(`(${left})().length === 0`, null, { timeout });
  } catch (err) {
    const stuck = await page.evaluate(
      `(${left})().map((el) => el.dataset.buildId + " " + el.dataset.buildLabel)`,
    );
    const crew = await page.locator("[data-swarm-crew]").textContent();
    throw new Error(`stuck on ${stuck.join(", ")} with ${crew}`, { cause: err });
  }
}

async function landing(name, arrive) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(track);
  await arrive(page);
  await page.waitForTimeout(1200);
  const nav = await page.evaluate(() => ({
    y: Math.round(scrollY),
    hero: document.querySelectorAll('[data-build-section="hero"] [data-built]').length,
  }));
  const log = await page.evaluate(
    () =>
      document.querySelectorAll('[data-build-section="log"] [data-build]:not([data-built])').length,
  );
  await allBuilt(page);
  const { first, done } = await page.evaluate(() => window.__build);
  check(`${name}: page opens at the section`, nav.y > 500, `scrollY ${nav.y}`);
  check(
    `${name}: the viewed section finishes before anything above starts`,
    done.log < Math.min(first.method, first.hands, first.hero),
    JSON.stringify({ log: done.log, first }),
  );
  check(
    `${name}: the crew works back up the page`,
    first.method < first.hands && first.hands < first.hero,
    JSON.stringify(first),
  );
  check(`${name}: work had started right away`, log < 20, `${log} left in the log after 1.2s`);
  const replay = await page.getByRole("button", { name: "replay" }).count();
  check(`${name}: replay is offered, not skip intro`, replay === 1);
  check(`${name}: no errors`, errors.length === 0, errors.join(" | "));
  await page.close();
}

await landing("hash link", (page) => page.goto(`${base}/#log`));
await landing("reload mid-page", async (page) => {
  await page.goto(`${base}/#log`);
  await page.waitForTimeout(800);
  await page.reload();
});

// Scrolling elsewhere while the crew works up the page takes priority.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(track);
  await page.goto(`${base}/#waitlist`);
  await page.waitForFunction(() => document.querySelector("#waitlist [data-built]"));
  await page.evaluate(() =>
    document.getElementById("hands").scrollIntoView({ behavior: "instant" }),
  );
  await allBuilt(page);
  const { first, done } = await page.evaluate(() => window.__build);
  check(
    "scrolling up pulls that section to the front",
    done.hands < first.hero && first.hands < (first.method ?? Infinity),
    JSON.stringify({ first, handsDone: done.hands }),
  );
  await page.close();
}

// Jumping past sections from the top leaves no gap behind.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).click();
  await page.getByRole("button", { name: "replay" }).waitFor({ timeout: 40000 });
  await page.evaluate(() => document.getElementById("log").scrollIntoView({ behavior: "instant" }));
  await allBuilt(page);
  check("sections jumped past still get built", true);
  await page.close();
}

// Scrolling up to the hero while the crew works up the page brings it forward.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(track);
  await page.goto(`${base}/#log`);
  await page.waitForFunction(() => document.querySelector("#log [data-built]"));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForFunction(
    () => document.querySelector('section[data-build-section="hero"] [data-built]'),
    null,
    { timeout: 30000 },
  );
  const { first } = await page.evaluate(() => window.__build);
  check(
    "scrolling up to the hero brings it forward",
    !("hands" in first) && !("method" in first),
    JSON.stringify(first),
  );
  await page.close();
}

// A normal visit still opens with the hero intro.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base);
  await page.getByRole("button", { name: "skip intro" }).waitFor({ timeout: 8000 });
  check("loading at the top still plays the intro", true);
  await page.close();
}

await browser.close();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  ${r.detail}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
