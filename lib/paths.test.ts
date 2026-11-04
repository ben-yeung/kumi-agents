import { describe, expect, it } from "vitest";
import { curveControl, distance, quadPoint, travelSeconds } from "@/lib/paths";

describe("paths", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 100, y: 0 };

  it("quadPoint hits both endpoints", () => {
    const c = curveControl(a, b, 0.2);
    expect(quadPoint(a, c, b, 0)).toEqual(a);
    expect(quadPoint(a, c, b, 1)).toEqual(b);
  });

  it("curveControl bends perpendicular to travel", () => {
    expect(curveControl(a, b, 0.2)).toEqual({ x: 50, y: 20 });
    expect(curveControl(a, b, -0.2)).toEqual({ x: 50, y: -20 });
  });

  it("travelSeconds grows with distance, is capped, and scales with speed", () => {
    expect(travelSeconds(10)).toBeLessThan(travelSeconds(400));
    expect(travelSeconds(1e6)).toBeCloseTo(1.4);
    expect(travelSeconds(400, 2)).toBeCloseTo(travelSeconds(400) / 2);
    expect(distance(a, b)).toBe(100);
  });
});
