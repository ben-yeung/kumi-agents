import { pointOn, rectOf, tween, type EffectContext } from "@/components/swarm/effects";
import type { Visit } from "@/lib/lanes";
import styles from "./ManyHands.module.css";

/** What a visit changes, kept in React; these functions only move the hands. */
export type VisitActions = {
  /** False once the visitor has flipped views, so the rest is settled unseen. */
  alive: () => boolean;
  progress: (value: number) => void;
  /** Marks the step done. `hold` leaves the next card waiting to be dragged. */
  finishStep: (hold: boolean) => void;
  /** Moves the waiting card to In progress. */
  startNext: () => void;
  /** The card waiting in Planned, if any. */
  nextCard: () => string | null;
};

/** What adding a piece changes. */
export type AddActions = Pick<VisitActions, "alive" | "startNext" | "nextCard"> & {
  /** Takes the next piece from the backlog, with nothing written yet. */
  open: () => void;
  /** Writes down the next step, and returns its card if there was one. */
  write: () => string | null;
};

const POP = [{ transform: "scale(0.5)" }, { transform: "scale(1.2)" }, { transform: "none" }];
const WRITE_MS = 340;

async function drawProgress(ctx: EffectContext, root: Element, visit: Visit, act: VisitActions) {
  const { agent } = ctx;
  const path = root.querySelector<SVGGeometryElement>("[data-stroke]");
  if (!path) return;
  const tip = () => pointOn(path, path.getTotalLength());
  agent.setAction("marking progress");
  await agent.moveTo(tip());
  agent.setTool("pencil");
  agent.press(true);
  await tween(ctx, 0.9, (t) => {
    act.progress(visit.from + (visit.to - visit.from) * t);
    agent.place(tip());
  });
  agent.press(false);
}

/** On a note: tick the step, then draw the rule further along. */
export async function workOnNote(
  ctx: EffectContext,
  note: HTMLElement,
  visit: Visit,
  act: VisitActions,
) {
  const { agent } = ctx;
  if (visit.tick !== null) {
    const step = note.querySelectorAll<HTMLElement>("[data-step]")[visit.tick];
    const r = rectOf(step);
    agent.setAction("ticking off");
    await agent.moveTo({ x: r.x + 8, y: r.y + r.h * 0.6 });
    agent.setTool("hand");
    await agent.tap();
    if (!act.alive()) return;
    act.finishStep(false);
    step.querySelector("svg")?.animate(POP, { duration: 320 / ctx.speed() });
    await agent.sleep(260);
    agent.setTool("dart");
  }
  if (act.alive()) await drawProgress(ctx, note, visit, act);
}

/** Lifts a copy of the card and carries it to the top of a column. */
async function drag(
  ctx: EffectContext,
  card: HTMLElement,
  to: HTMLElement,
  label: string,
  drop: () => void,
) {
  const { agent } = ctx;
  const from = rectOf(card);
  const grip = { x: from.x + Math.min(from.w * 0.3, 40), y: from.y + 14 };
  agent.setAction(label);
  await agent.moveTo(grip);
  agent.setTool("hand");
  await agent.tap();
  agent.press(true);

  const lifted = card.cloneNode(true) as HTMLElement;
  lifted.dataset.fx = "";
  lifted.removeAttribute("data-card");
  lifted.classList.add(styles.lifted);
  lifted.style.left = `${from.x}px`;
  lifted.style.top = `${from.y}px`;
  lifted.style.width = `${from.w}px`;
  lifted.style.height = `${from.h}px`;
  lifted.style.transform = "none";
  // First in the overlay, so the cursors stay on top of what they carry.
  ctx.overlay.prepend(lifted);
  card.style.visibility = "hidden";
  const putDown = () => {
    lifted.remove();
    card.style.removeProperty("visibility");
  };
  ctx.onTeardown(putDown);

  try {
    const target = rectOf(to);
    const dx = target.x - from.x;
    const dy = target.y - from.y;
    await tween(
      ctx,
      Math.min(Math.max(Math.hypot(dx, dy) / 620, 0.7), 1.5),
      (t) => {
        lifted.style.left = `${from.x + dx * t}px`;
        lifted.style.top = `${from.y + dy * t}px`;
        agent.place({ x: grip.x + dx * t, y: grip.y + dy * t });
      },
      [0.42, 0.02, 0.2, 1],
    );
    agent.press(false);
    drop();
  } finally {
    putDown();
  }
}

function cardEl(root: HTMLElement, id: string) {
  return root.querySelector<HTMLElement>(`[data-card="${id}"]`);
}

function columnList(root: HTMLElement, status: string) {
  return root.querySelector<HTMLElement>(`[data-column="${status}"] ol`);
}

/** Brings up the card waiting in Planned. */
async function pickUpNext(ctx: EffectContext, root: HTMLElement, act: AddActions | VisitActions) {
  const nextId = act.nextCard();
  const next = nextId ? cardEl(root, nextId) : null;
  const doing = columnList(root, "doing");
  if (!next || !doing || !act.alive()) return;
  ctx.agent.setTool("dart");
  await drag(ctx, next, doing, "picking up next", () => act.startNext());
}

/** On the board: take the card to 100%, then drag it to Completed. */
export async function workOnBoard(
  ctx: EffectContext,
  root: HTMLElement,
  card: HTMLElement,
  visit: Visit,
  act: VisitActions,
) {
  await drawProgress(ctx, card, visit, act);
  if (!act.alive()) return;

  const done = columnList(root, "done");
  if (!done) return;
  await drag(ctx, card, done, "moving card", () => act.finishStep(true));
  await ctx.agent.sleep(420);
  await pickUpNext(ctx, root, act);
}

/** On a note: retitle it, then write the new steps out one by one. */
export async function addToNote(ctx: EffectContext, note: HTMLElement, act: AddActions) {
  const { agent } = ctx;
  const title = note.querySelector("h3");
  if (!title) return;
  const r = rectOf(title);
  agent.setAction("adding tasks");
  await agent.moveTo({ x: r.x + 8, y: r.y + r.h / 2 });
  agent.setTool("pencil");
  await agent.tap();
  if (!act.alive()) return;
  act.open();
  for (const step of note.querySelectorAll<HTMLElement>("[data-step]")) {
    const s = rectOf(step);
    await agent.moveTo({ x: s.x + 8, y: s.y + s.h / 2 });
    if (!act.alive()) return;
    act.write();
    await agent.sleep(WRITE_MS);
  }
}

/** On the board: write new cards at the top of Planned, then pick up the first. */
export async function addToBoard(ctx: EffectContext, root: HTMLElement, act: AddActions) {
  const { agent } = ctx;
  const planned = columnList(root, "planned");
  if (!planned) return;
  const r = rectOf(planned);
  agent.setAction("adding tasks");
  await agent.moveTo({ x: r.x + Math.min(r.w * 0.3, 40), y: r.y + 24 });
  agent.setTool("pencil");
  await agent.tap();
  if (!act.alive()) return;
  act.open();
  for (let id = act.write(); id; id = act.write()) {
    cardEl(root, id)?.animate(POP, { duration: 320 / ctx.speed() });
    await agent.sleep(WRITE_MS);
    if (!act.alive()) return;
  }
  await pickUpNext(ctx, root, act);
}
