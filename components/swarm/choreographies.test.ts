import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { CHOREOGRAPHIES, HERO_IDS, chooseChoreography, planHero } from "./choreographies";

describe("choreographies", () => {
  it.each(CHOREOGRAPHIES.map((c) => [c.name, c] as const))(
    "%s covers every hero id exactly once",
    (_, c) => {
      const ids = [...c.lanes.flat().map((s) => s.id), ...(c.pass ?? [])];
      expect([...ids].sort()).toEqual([...HERO_IDS].sort());
    },
  );

  it("assigns one distinct agent per lane, chaining steps in each lane", () => {
    for (const c of CHOREOGRAPHIES) {
      const plan = planHero(c, createRng(5), {});
      expect(new Set(plan.cast).size).toBe(c.lanes.length);
      for (const [i, lane] of c.lanes.entries()) {
        for (const [j, step] of lane.entries()) {
          const o = plan.overrides.get(step.id)!;
          expect(o.agent).toBe(plan.cast[i]);
          if (j > 0) expect(o.after).toContain(lane[j - 1].id);
        }
      }
    }
  });

  it("stumbles on the headline in choreographies that ask for it", () => {
    for (const c of CHOREOGRAPHIES) {
      const plan = planHero(c, createRng(1));
      const wants = c.lanes.flat().some((st) => st.rewrite);
      expect(Boolean(plan.overrides.get("hero.title")?.rewrite)).toBe(wants);
    }
  });

  it("never repeats the previous choreography", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(chooseChoreography(createRng(seed), "relay").name).not.toBe("relay");
    }
  });
});
