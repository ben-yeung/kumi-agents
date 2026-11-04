import { describe, expect, it } from "vitest";
import { WATCH_INTENT, createVisitorIdentity, isClickable, resolveIntent } from "@/lib/visitor";

describe("createVisitorIdentity", () => {
  it("is stable for a seed", () => {
    expect(createVisitorIdentity(123)).toEqual(createVisitorIdentity(123));
  });

  it("picks a hue away from the crew's colors", () => {
    const claimed = [140, 85, 260, 10, 305, 120, 45, 65];
    for (let seed = 0; seed < 300; seed++) {
      const id = createVisitorIdentity(seed);
      for (const c of claimed) {
        const d = Math.abs(id.hue - c) % 360;
        expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe("isClickable", () => {
  it("is true for links and buttons, but not unbuilt ones", () => {
    document.body.innerHTML = `<a id="a" href="#x"><span id="s">go</span></a><button id="b"></button><p id="p"></p>`;
    expect(isClickable(document.getElementById("s"))).toBe(true);
    expect(isClickable(document.getElementById("b"))).toBe(true);
    expect(isClickable(document.getElementById("p"))).toBe(false);
    expect(isClickable(null)).toBe(false);

    document.documentElement.setAttribute("data-swarm", "live");
    document.getElementById("a")!.setAttribute("data-build", "box");
    expect(isClickable(document.getElementById("s"))).toBe(false);
    document.documentElement.removeAttribute("data-swarm");
  });
});

describe("resolveIntent", () => {
  function setup() {
    document.body.innerHTML = `
      <section data-intent="reading the section">
        <a id="cta" data-intent="about to begin" data-intent-press="joining the waitlist">
          <span id="inner">Begin</span>
        </a>
        <p id="plain">text</p>
      </section>
      <div id="none"></div>`;
  }

  it("uses the nearest data-intent", () => {
    setup();
    expect(resolveIntent(document.getElementById("inner"), false)).toBe("about to begin");
    expect(resolveIntent(document.getElementById("plain"), false)).toBe("reading the section");
  });

  it("prefers data-intent-press while pressed", () => {
    setup();
    expect(resolveIntent(document.getElementById("inner"), true)).toBe("joining the waitlist");
    expect(resolveIntent(document.getElementById("plain"), true)).toBe("reading the section");
  });

  it("says you are watching the crew over parts not built yet", () => {
    setup();
    document.documentElement.setAttribute("data-swarm", "live");
    document.getElementById("cta")!.setAttribute("data-build", "box");
    expect(resolveIntent(document.getElementById("inner"), false)).toBe(WATCH_INTENT);
    document.getElementById("cta")!.setAttribute("data-built", "");
    expect(resolveIntent(document.getElementById("inner"), false)).toBe("about to begin");
    document.documentElement.removeAttribute("data-swarm");
  });

  it("returns null when nothing declares an intent", () => {
    setup();
    expect(resolveIntent(document.getElementById("none"), false)).toBeNull();
    expect(resolveIntent(null, false)).toBeNull();
  });
});
