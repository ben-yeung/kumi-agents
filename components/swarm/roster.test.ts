import { describe, expect, it } from "vitest";
import { nextArrival, restingCrew } from "./roster";

describe("roster", () => {
  it("brings in whoever has been away longest", () => {
    const seen = new Map([
      ["ren", 300],
      ["sol", 100],
      ["ivo", 200],
    ] as const);
    expect(nextArrival(["ren", "sol", "ivo"], [], seen)).toBe("sol");
    expect(nextArrival(["ren", "sol", "ivo"], ["sol"], seen)).toBe("ivo");
  });

  it("gives agents not yet seen the first turn", () => {
    expect(nextArrival(["ren", "tao"], [], new Map([["ren", 1]]))).toBe("tao");
  });

  it("has nobody to send when everyone is here", () => {
    expect(nextArrival(["ren"], ["ren"], new Map())).toBeNull();
  });

  it("rests a smaller crew on phones", () => {
    expect(restingCrew(8)).toEqual({ min: 2, max: 4 });
    expect(restingCrew(4)).toEqual({ min: 1, max: 3 });
  });
});
