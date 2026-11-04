import { animate } from "motion/react";
import { Aborted, type AgentRuntime } from "@/components/swarm/agent";
import type { BuildKind, Task } from "@/components/swarm/types";
import type { Point } from "@/lib/paths";
import type { Rng } from "@/lib/rng";
import styles from "./Swarm.module.css";

export type EffectContext = {
  el: HTMLElement;
  task: Task;
  agent: AgentRuntime;
  overlay: HTMLElement;
  rng: Rng;
  speed: () => number;
  skipping: () => boolean;
  aborted: () => boolean;
  /** Registers undo work that must also run if the swarm is torn down mid-effect. */
  onTeardown: (undo: () => void) => void;
  /** For frames: called with a function that clears the scaffolding later. */
  holdScaffold: (release: () => void) => void;
};

type Rect = { x: number; y: number; w: number; h: number };

function once(fn: () => void) {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

const EASE_SOFT: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

/* ---------------------------------------------------------------- helpers */

export function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

/** Bounds of what is actually drawn: tight around text for text blocks. */
export function contentRect(el: Element): Rect {
  const box = rectOf(el);
  if (!el.textContent?.trim() || el.querySelector("svg, img")) return box;
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  if (!r.width || !r.height) return box;
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

export function markBuilding(el: HTMLElement) {
  el.setAttribute("data-building", "");
}

export function markBuilt(el: HTMLElement) {
  el.removeAttribute("data-building");
  el.setAttribute("data-built", "");
}

/** Back to the unbuilt state, clearing anything an effect may have left inline. */
export function unbuild(el: HTMLElement) {
  el.removeAttribute("data-built");
  el.removeAttribute("data-building");
  for (const prop of ["opacity", "color", "transition", "filter"]) el.style.removeProperty(prop);
}

/** Animates 0 to 1 over `seconds`, calling `update` each frame. Instant when skipping. */
export async function tween(
  ctx: EffectContext,
  seconds: number,
  update: (t: number) => void,
  ease: [number, number, number, number] | "linear" = EASE_SOFT,
) {
  if (ctx.skipping()) {
    update(1);
    return;
  }
  await animate(0, 1, {
    duration: seconds / ctx.speed(),
    ease,
    onUpdate: (t) => {
      if (!ctx.aborted()) update(t);
    },
  });
  if (ctx.aborted()) throw new Aborted();
  update(1);
}

function overlayEl(ctx: EffectContext, className: string, r: Partial<Rect> = {}) {
  const div = document.createElement("div");
  div.className = className;
  div.dataset.fx = "";
  div.style.setProperty("--c", ctx.agent.agent.color);
  place(div, r);
  ctx.overlay.appendChild(div);
  return div;
}

function place(div: HTMLElement, r: Partial<Rect>) {
  if (r.x !== undefined) div.style.left = `${r.x}px`;
  if (r.y !== undefined) div.style.top = `${r.y}px`;
  if (r.w !== undefined) div.style.width = `${Math.max(r.w, 0)}px`;
  if (r.h !== undefined) div.style.height = `${Math.max(r.h, 0)}px`;
}

function fadeOutAndRemove(div: HTMLElement, ms = 450, delay = 0) {
  const a = div.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: ms,
    delay,
    easing: "ease-out",
    fill: "forwards",
  });
  a.onfinish = () => div.remove();
}

/** A faint wash of the builder's color that lingers, then fades: "ren was here". */
function glow(ctx: EffectContext, r: Rect) {
  if (ctx.skipping()) return;
  const div = overlayEl(ctx, styles.glow, r);
  fadeOutAndRemove(div, 1400, 200);
}

function fadeIn(el: HTMLElement, ms: number, from: Keyframe = { opacity: 0 }) {
  markBuilt(el);
  if (ms <= 0) return;
  const to: Keyframe = { opacity: 1 };
  if ("transform" in from) to.transform = "none";
  if ("filter" in from) to.filter = "none";
  el.animate([from, to], {
    duration: ms,
    easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  });
}

/** Tints text with the builder's color while it is written, then lets it settle. */
function tintText(el: HTMLElement, color: string) {
  el.style.color = `color-mix(in srgb, ${color} 62%, currentColor)`;
  return () => {
    el.style.transition = "color 1.4s ease";
    el.style.removeProperty("color");
    window.setTimeout(() => el.style.removeProperty("transition"), 1500);
  };
}

/* ----------------------------------------------------------------- type */

function splitText(el: HTMLElement) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  const chars: HTMLSpanElement[] = [];
  const swaps: [HTMLSpanElement, Text][] = [];
  for (const node of nodes) {
    if (!node.data.trim()) continue;
    const wrapper = document.createElement("span");
    for (const ch of Array.from(node.data)) {
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.opacity = "0";
      wrapper.appendChild(s);
      chars.push(s);
    }
    node.replaceWith(wrapper);
    swaps.push([wrapper, node]);
  }
  // Put the original text nodes back so React's references stay valid.
  const restore = () => swaps.forEach(([w, n]) => w.replaceWith(n));
  return { chars, restore };
}

/**
 * Text-less marks inside a typed element (a colored dot, an icon), each paired
 * with the index of the first character after it. They stay hidden until the
 * typing reaches them, so nothing shows before the agent puts it there.
 */
function textlessMarks(el: HTMLElement, chars: HTMLSpanElement[]) {
  const marks: { node: HTMLElement | SVGElement; at: number }[] = [];
  el.querySelectorAll<HTMLElement | SVGElement>("*").forEach((node) => {
    if (node.textContent?.trim() || (node.closest("svg") !== node && node.closest("svg"))) return;
    if (chars.includes(node as HTMLSpanElement)) return;
    const at = chars.findIndex(
      (c) => node.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    node.style.opacity = "0";
    marks.push({ node, at: at === -1 ? chars.length : at });
  });
  return marks;
}

function revealMark(node: HTMLElement | SVGElement, ms: number) {
  node.style.removeProperty("opacity");
  if (ms > 0) {
    node.animate(
      [
        { opacity: 0, transform: "scale(0.4)" },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: ms,
        easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    );
  }
}

async function typeEffect(ctx: EffectContext) {
  const { el, agent, rng, task } = ctx;
  const { chars, restore } = splitText(el);
  const marks = textlessMarks(el, chars);
  const caret = overlayEl(ctx, styles.caret);
  caret.style.opacity = "0";
  const settleTint = tintText(el, agent.agent.color);
  const undo = once(() => {
    restore();
    marks.forEach((m) => m.node.style.removeProperty("opacity"));
    caret.remove();
    settleTint();
  });
  ctx.onTeardown(undo);
  try {
    if (!chars.length) return;
    const first = chars[0].getBoundingClientRect();
    const caretTo = (span: HTMLElement, after: boolean) => {
      const r = span.getBoundingClientRect();
      const x = (after ? r.right : r.left) + window.scrollX;
      const y = r.top + window.scrollY;
      place(caret, { x, y: y + r.height * 0.12, h: r.height * 0.8 });
      // The I-beam rides just ahead of the caret, clear of the typed letters.
      return { x: x + 10, y: y + r.height * 0.52 } satisfies Point;
    };
    await agent.moveTo({
      x: first.left + window.scrollX + 10,
      y: first.top + window.scrollY + first.height * 0.52,
    });
    // Only now, with the agent at the first character, does anything show.
    agent.setTool("ibeam");
    markBuilding(el);
    caret.style.removeProperty("opacity");
    caretTo(chars[0], false);

    const text = chars.map((c) => c.textContent).join("");
    const stumbleAt = task.rewrite ? text.indexOf(task.rewrite.word) : -1;
    const total = Math.min(Math.max(chars.length * 30, 380), 1400) / (task.pace ?? 1);
    const per = total / chars.length;

    for (let i = 0; i < chars.length; i++) {
      if (i === stumbleAt && task.rewrite) {
        await stumble(ctx, chars[i], task.rewrite.wrong, per, caretTo);
      }
      for (const m of marks) if (m.at === i) revealMark(m.node, ctx.skipping() ? 0 : 260);
      chars[i].style.opacity = "1";
      agent.nudge(caretTo(chars[i], true));
      const ch = chars[i].textContent ?? "";
      const pause = /[,.]/.test(ch) ? 4 : ch === " " ? 1.4 : 0.55 + rng.next() * 0.9;
      await agent.sleep(per * pause);
    }
    await agent.sleep(140);
    for (const m of marks) if (m.at >= chars.length) revealMark(m.node, ctx.skipping() ? 0 : 260);
  } finally {
    undo();
  }
  markBuilt(el);
}

/** Types the wrong word, pauses, backspaces it. */
async function stumble(
  ctx: EffectContext,
  before: HTMLSpanElement,
  wrong: string,
  per: number,
  caretTo: (span: HTMLElement, after: boolean) => Point,
) {
  const { agent } = ctx;
  // Absolutely positioned at its static spot: it sits where the right word
  // will go but takes no space, so the line never reflows.
  const ghost = document.createElement("span");
  ghost.style.position = "absolute";
  ghost.style.whiteSpace = "pre";
  before.before(ghost);
  const typed: HTMLSpanElement[] = [];
  for (const ch of Array.from(wrong)) {
    const s = document.createElement("span");
    s.textContent = ch;
    ghost.appendChild(s);
    typed.push(s);
    agent.nudge(caretTo(s, true));
    await agent.sleep(per * 1.3);
  }
  const action = agent.snapshot().action;
  agent.setAction("hmm, no");
  await agent.sleep(520);
  while (typed.length) {
    typed.pop()!.remove();
    agent.nudge(typed.length ? caretTo(typed[typed.length - 1], true) : caretTo(before, false));
    await agent.sleep(per * 0.7);
  }
  ghost.remove();
  agent.setAction(action);
  await agent.sleep(160);
}

/* ------------------------------------------------------------ box/frame */

async function dragOut(ctx: EffectContext, className: string, r: Rect, pace = 1) {
  const { agent } = ctx;
  await agent.moveTo({ x: r.x, y: r.y });
  const box = overlayEl(ctx, className, { x: r.x, y: r.y, w: 0, h: 0 });
  agent.setTool("cross");
  agent.press(true);
  const seconds = Math.min(Math.max((r.w + r.h) / 1300, 0.35), 0.95) / pace;
  await tween(ctx, seconds, (t) => {
    place(box, { w: r.w * t, h: r.h * t });
    agent.place({ x: r.x + r.w * t, y: r.y + r.h * t });
  });
  agent.press(false);
  return box;
}

async function boxEffect(ctx: EffectContext) {
  const r = rectOf(ctx.el);
  const box = await dragOut(ctx, styles.outline, r);
  await ctx.agent.sleep(120);
  fadeIn(ctx.el, ctx.skipping() ? 0 : 380 / ctx.speed(), { opacity: 0, transform: "scale(0.985)" });
  glow(ctx, r);
  fadeOutAndRemove(box, 500, 250);
}

async function frameEffect(ctx: EffectContext) {
  const pad = 14;
  const raw = rectOf(ctx.el);
  const r = { x: raw.x - pad, y: raw.y - pad, w: raw.w + pad * 2, h: raw.h + pad * 2 };
  const frame = await dragOut(ctx, styles.frame, r, 0.85);
  markBuilt(ctx.el);
  if (ctx.skipping()) {
    frame.remove();
    return;
  }
  ctx.holdScaffold(() => fadeOutAndRemove(frame, 700, 300));
}

/* --------------------------------------------------------------- stroke */

export function pointOn(path: SVGGeometryElement, length: number): Point {
  const p = path.getPointAtLength(length);
  const m = path.getScreenCTM();
  if (!m) {
    const r = path.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY };
  }
  const s = new DOMPoint(p.x, p.y).matrixTransform(m);
  return { x: s.x + window.scrollX, y: s.y + window.scrollY };
}

/** A non-scaling stroke measures its dashes on screen, not in the viewBox. */
function dashLength(path: SVGGeometryElement) {
  const length = path.getTotalLength();
  if (getComputedStyle(path).vectorEffect !== "non-scaling-stroke") return length;
  return length * Math.abs(path.getScreenCTM()?.a ?? 1);
}

async function strokeEffect(ctx: EffectContext) {
  const { el, agent } = ctx;
  const marked = el.querySelectorAll<SVGGeometryElement>("[data-stroke]");
  const paths = Array.from(
    marked.length
      ? marked
      : el.querySelectorAll<SVGGeometryElement>("path, circle, line, polyline"),
  );
  if (!paths.length) return fadeIn(el, ctx.skipping() ? 0 : 300 / ctx.speed());

  const lengths = paths.map(dashLength);
  paths.forEach((p, i) => {
    p.style.strokeDasharray = `${lengths[i]} ${lengths[i]}`;
    p.style.strokeDashoffset = `${lengths[i]}`;
  });
  markBuilding(el);
  const undo = once(() =>
    paths.forEach((p) => {
      p.style.removeProperty("stroke-dasharray");
      p.style.removeProperty("stroke-dashoffset");
    }),
  );
  ctx.onTeardown(undo);

  try {
    // Ride the last (main) path; the others are drawn alongside it.
    const lead = paths[paths.length - 1];
    const leadLen = lead.getTotalLength();
    let screenLen = 0;
    let prev = pointOn(lead, 0);
    for (let i = 1; i <= 12; i++) {
      const p = pointOn(lead, (leadLen * i) / 12);
      screenLen += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    await agent.moveTo(pointOn(lead, 0));
    agent.setTool("pencil");
    agent.press(true);
    const seconds = Math.min(Math.max(screenLen / 760, 0.3), 2.1);
    await tween(
      ctx,
      seconds,
      (t) => {
        paths.forEach((p, i) => (p.style.strokeDashoffset = `${lengths[i] * (1 - t)}`));
        agent.place(pointOn(lead, leadLen * t));
      },
      [0.5, 0.1, 0.35, 1],
    );
    agent.press(false);
  } finally {
    undo();
  }
  markBuilt(el);
}

/* -------------------------------------------------------------- develop */

async function developEffect(ctx: EffectContext) {
  const r = contentRect(ctx.el);
  const pad = 6;
  const marquee = await dragOut(
    ctx,
    styles.marquee,
    { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 },
    1.8,
  );
  fadeIn(ctx.el, ctx.skipping() ? 0 : 800 / ctx.speed(), { opacity: 0, filter: "blur(7px)" });
  fadeOutAndRemove(marquee, 400, 350);
  ctx.agent.setTool("loupe");
  await ctx.agent.sleep(620);
}

/* ----------------------------------------------------------------- list */

async function listEffect(ctx: EffectContext) {
  const { el, agent } = ctx;
  const items = Array.from(el.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.offsetParent !== null,
  );
  items.forEach((i) => (i.style.opacity = "0"));
  const undo = once(() => items.forEach((i) => i.style.removeProperty("opacity")));
  ctx.onTeardown(undo);
  markBuilding(el);
  agent.setTool("hand");
  try {
    for (const item of items) {
      const r = rectOf(item);
      await agent.moveTo({ x: r.x + Math.min(r.w * 0.35, 16), y: r.y + r.h * 0.75 }, { speed: 2 });
      void agent.tap();
      item.style.removeProperty("opacity");
      if (!ctx.skipping()) {
        item.animate(
          [
            { opacity: 0, transform: "translateY(5px) scale(0.96)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 300 / ctx.speed(), easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
        );
      }
      await agent.sleep(40);
    }
  } finally {
    undo();
  }
  markBuilt(el);
}

/* --------------------------------------------------------------- reveal */

async function revealEffect(ctx: EffectContext) {
  const r = contentRect(ctx.el);
  await ctx.agent.moveTo({ x: r.x + Math.min(r.w * 0.4, 24), y: r.y + r.h * 0.7 });
  ctx.agent.setTool("hand");
  await ctx.agent.tap();
  fadeIn(ctx.el, ctx.skipping() ? 0 : 420 / ctx.speed(), {
    opacity: 0,
    transform: "translateY(4px)",
  });
  glow(ctx, r);
}

/* ------------------------------------------------------------- dispatch */

const EFFECTS: Record<BuildKind, (ctx: EffectContext) => Promise<void>> = {
  type: typeEffect,
  box: boxEffect,
  frame: frameEffect,
  stroke: strokeEffect,
  develop: developEffect,
  list: listEffect,
  reveal: revealEffect,
  pass: async (ctx) => markBuilt(ctx.el),
};

export function runEffect(ctx: EffectContext) {
  return EFFECTS[ctx.task.kind](ctx);
}

export const DEFAULT_LABELS: Record<BuildKind, string> = {
  type: "writing",
  box: "boxing",
  frame: "scaffolding",
  stroke: "drawing",
  develop: "developing",
  list: "placing",
  reveal: "placing",
  pass: "",
};
