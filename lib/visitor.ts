import { createRng } from "@/lib/rng";

/** The visitor is always just "you"; only their color is their own. */
export type VisitorIdentity = {
  /** Hue in degrees, rendered as a soft oklch pastel. */
  hue: number;
  seed: number;
};

/**
 * Hue bands already claimed by the crew's pastels, so a visitor never
 * looks like one of the agents. Values are oklch hue degrees.
 */
// Keep in sync with the --agent-* hues in app/globals.css.
const CLAIMED_HUES = [140, 85, 260, 10, 305, 120, 45, 65];
const MIN_HUE_DISTANCE = 12;

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function createVisitorIdentity(seed: number): VisitorIdentity {
  const rng = createRng(seed);
  let hue = rng.int(0, 359);
  for (let tries = 0; tries < 36; tries++) {
    if (CLAIMED_HUES.every((c) => hueDistance(c, hue) >= MIN_HUE_DISTANCE)) break;
    hue = (hue + 10) % 360;
  }
  return { hue, seed };
}

export function visitorColor(hue: number) {
  return `oklch(var(--visitor-l) var(--visitor-c) ${hue})`;
}

/** Fallback phrases when the pointer is not over anything with an intent. */
export const IDLE_INTENT = "lingering";
export const WANDER_INTENT = "wandering";
export const SCROLL_INTENT = "scrolling";
export const SELECT_INTENT = "selecting";
export const WATCH_INTENT = "watching";

const UNBUILT = "html[data-swarm] [data-build]:not([data-built]):not([data-building])";
const CLICKABLE = 'a[href], button, [role="button"], label, summary, select';

/** True over something that can be clicked (and has actually been built). */
export function isClickable(target: Element | null) {
  if (!target || target.closest(UNBUILT)) return false;
  return target.closest(CLICKABLE) !== null;
}

/**
 * Resolves what the visitor is doing from the element under the pointer.
 * Elements opt in with `data-intent` (hover) and `data-intent-press`
 * (while pressed). The nearest ancestor wins.
 */
export function resolveIntent(target: Element | null, pressed: boolean): string | null {
  if (!target) return null;
  // Hovering where the crew has not built yet: there is nothing to read there.
  if (target.closest(UNBUILT)) {
    return WATCH_INTENT;
  }
  if (pressed) {
    const pressEl = target.closest("[data-intent-press]");
    if (pressEl) return pressEl.getAttribute("data-intent-press");
  }
  const el = target.closest("[data-intent]");
  return el ? el.getAttribute("data-intent") : null;
}
