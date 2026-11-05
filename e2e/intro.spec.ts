// The intro, skip and replay, and the reduced-motion page.
import {
  buildWholePage,
  expect,
  heroSettledMs,
  replayButton,
  sectionBuilt,
  settle,
  skipButton,
  test,
  unbuiltCount,
} from "./support";

const lastChoreography = () => sessionStorage.getItem("kumi-last-choreo");

test("every visit plays the full intro, and a reload changes the choreography", async ({
  page,
}) => {
  await page.goto("/");
  const firstMs = await heroSettledMs(page);
  const first = await page.evaluate(lastChoreography);
  await page.reload();
  const secondMs = await heroSettledMs(page);
  const second = await page.evaluate(lastChoreography);

  // Choreographies differ in length, so each is held to the range rather than to the other.
  expect(firstMs, `intro ${first}`).toBeGreaterThan(6000);
  expect(firstMs, `intro ${first}`).toBeLessThan(20_000);
  expect(secondMs, `reload ${second}`).toBeGreaterThan(6000);
  expect(secondMs, `reload ${second}`).toBeLessThan(20_000);
  expect(second).not.toBe(first);
});

test("skip finishes the hero immediately", async ({ page }) => {
  await page.goto("/");
  await skipButton(page).click();
  await replayButton(page).waitFor({ timeout: 3000 });
  expect(await unbuiltCount(page, '[data-build-section="hero"]')).toBe(0);
});

test("replay plays the hero again", async ({ page }) => {
  await settle(page);
  await replayButton(page).click();
  await skipButton(page).waitFor();
  expect(await heroSettledMs(page)).toBeGreaterThan(1500);
});

test("the page builds, the log grows, and replay unsets it all", async ({ page }) => {
  await settle(page);

  await page.evaluate(() =>
    document.getElementById("log")!.scrollIntoView({ behavior: "instant" }),
  );
  await page.waitForFunction(() => document.querySelectorAll("#worklog > li").length > 8, null, {
    timeout: 40_000,
  });
  await buildWholePage(page);

  await replayButton(page).click();
  await skipButton(page).waitFor();
  const reset = await page.evaluate(() => ({
    y: window.scrollY,
    hands: document.querySelectorAll("#hands [data-built]").length,
    rows: document.querySelectorAll("#worklog > li").length,
  }));
  expect(reset).toEqual({ y: 0, hands: 0, rows: 8 });

  await heroSettledMs(page);
  await page.evaluate(() =>
    document.getElementById("hands")!.scrollIntoView({ behavior: "instant" }),
  );
  await sectionBuilt(page, "hands", 40_000);
});

test("the bar buttons are the same size", async ({ page }) => {
  await page.goto("/");
  const buttons = page.locator("[data-swarm-controls] button");
  await buttons.first().waitFor();
  const [tag, replay] = await Promise.all([
    buttons.nth(0).boundingBox(),
    buttons.nth(1).boundingBox(),
  ]);
  expect({ width: tag!.width, height: tag!.height }).toEqual({
    width: replay!.width,
    height: replay!.height,
  });
});

test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(800);
  });

  test("the page is finished, with no crew", async ({ page }) => {
    const swarm = await page.evaluate(() => document.documentElement.getAttribute("data-swarm"));
    expect(swarm).toBeNull();
    await expect(page.locator("[data-swarm-controls]")).toHaveCount(0);
    await expect(page.locator("#hero-title")).toHaveCSS("opacity", "1");
  });

  test("the tag setting stays reachable", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Show actions in cursor tags" })).toHaveCount(1);
  });

  test("hover statuses are short, and no two say the same thing", async ({ page }) => {
    const intents = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-intent], [data-intent-press]")].flatMap(
        (el) => [el.dataset.intent, el.dataset.intentPress].filter((t): t is string => !!t),
      ),
    );
    expect(intents.length).toBeGreaterThan(0);
    expect(intents.filter((t, i) => intents.indexOf(t) !== i)).toEqual([]);
    // The closing call to action is the one status meant to say more.
    const callToAction = "claiming a spot on the waitlist";
    expect(intents.filter((t) => t.length > 16 && t !== callToAction)).toEqual([]);
  });
});
