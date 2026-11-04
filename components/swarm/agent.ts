import {
  animate,
  motionValue,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import type { PointerVariant } from "@/components/ui/Pointer";
import type { Agent } from "@/lib/agents";
import { curveControl, distance, quadPoint, travelSeconds, type Point } from "@/lib/paths";
import type { Rng } from "@/lib/rng";

export class Aborted extends Error {
  constructor() {
    super("swarm aborted");
  }
}

export type AgentSnapshot = {
  action: string | null;
  pressed: boolean;
  idle: boolean;
  flipX: boolean;
  /** The pointer shows what the agent is doing with its hands. */
  tool: PointerVariant;
};

/** Shared by every agent so the engine can stop, skip or speed up all of them at once. */
export type Clock = {
  aborted: () => boolean;
  skipping: () => boolean;
  speed: () => number;
};

const EASE_HAND: [number, number, number, number] = [0.42, 0.02, 0.2, 1];

/**
 * One agent on the crew: position (document coordinates), a curved,
 * hand-like way of moving, and the status its tag shows.
 */
export class AgentRuntime {
  readonly x: MotionValue<number>;
  readonly y: MotionValue<number>;
  private snap: AgentSnapshot = {
    action: null,
    pressed: false,
    idle: false,
    flipX: false,
    tool: "dart",
  };
  private listeners = new Set<() => void>();
  private moving: AnimationPlaybackControls | null = null;
  /** Motion's stop() never settles its promise, so a stopped move is released here. */
  private releaseMove: (() => void) | null = null;
  private nudging: [AnimationPlaybackControls | null, AnimationPlaybackControls | null] = [
    null,
    null,
  ];

  constructor(
    readonly agent: Agent,
    start: Point,
    private clock: Clock,
    private rng: Rng,
  ) {
    this.x = motionValue(start.x);
    this.y = motionValue(start.y);
    // Flip the tag from where the agent actually is, with a little hysteresis.
    this.x.on("change", (x) => this.updateFlip(x));
  }

  get id() {
    return this.agent.id;
  }

  pos(): Point {
    return { x: this.x.get(), y: this.y.get() };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  snapshot = () => this.snap;

  private patch(next: Partial<AgentSnapshot>) {
    const merged = { ...this.snap, ...next };
    const changed = (Object.keys(next) as (keyof AgentSnapshot)[]).some(
      (k) => merged[k] !== this.snap[k],
    );
    if (!changed) return;
    this.snap = merged;
    this.listeners.forEach((l) => l());
  }

  setAction(action: string | null, idle = false) {
    this.patch({ action, idle });
  }

  private check() {
    if (this.clock.aborted()) throw new Aborted();
  }

  /** Put the tag on whichever side has room, with a little hysteresis. */
  private updateFlip(x: number) {
    const fromLeft = x - window.scrollX;
    const fromRight = window.innerWidth - fromLeft;
    const roomy = 230;
    if (!this.snap.flipX && fromRight < roomy && fromLeft > fromRight + 40) {
      this.patch({ flipX: true });
    } else if (this.snap.flipX && (fromRight > roomy + 50 || fromLeft < fromRight - 40)) {
      this.patch({ flipX: false });
    }
  }

  /** Travel along a gentle curve. Resolves on arrival. */
  async moveTo(to: Point, opts: { speed?: number; bend?: number } = {}) {
    this.check();
    this.stop();
    const from = this.pos();
    const d = distance(from, to);
    if (this.clock.skipping() || d < 0.5) {
      this.x.set(to.x);
      this.y.set(to.y);
      return;
    }
    const bend = opts.bend ?? (this.rng.next() - 0.5) * 0.5;
    const c = curveControl(from, to, bend);
    const duration = travelSeconds(d, (opts.speed ?? 1) * this.clock.speed());
    const controls = animate(0, 1, {
      duration,
      ease: EASE_HAND,
      onUpdate: (t) => {
        const p = quadPoint(from, c, to, t);
        this.x.set(p.x);
        this.y.set(p.y);
      },
    });
    this.moving = controls;
    await Promise.race([
      controls,
      new Promise<void>((resolve) => {
        this.releaseMove = resolve;
      }),
    ]);
    if (this.moving === controls) this.moving = null;
    this.check();
  }

  /** Short, non-blocking follow used while typing or drawing. */
  nudge(to: Point, seconds = 0.16) {
    this.stopNudges();
    if (this.clock.skipping()) {
      this.x.set(to.x);
      this.y.set(to.y);
      return;
    }
    const opts = { duration: seconds / this.clock.speed(), ease: "easeOut" as const };
    this.nudging = [animate(this.x, to.x, opts), animate(this.y, to.y, opts)];
  }

  /** Jump without animation (used while drawing along a path). */
  place(to: Point) {
    this.stopNudges();
    this.x.set(to.x);
    this.y.set(to.y);
  }

  private stopNudges() {
    this.nudging[0]?.stop();
    this.nudging[1]?.stop();
    this.nudging = [null, null];
  }

  setTool(tool: PointerVariant) {
    this.patch({ tool });
  }

  press(down: boolean) {
    this.patch({ pressed: down });
  }

  async tap() {
    this.press(true);
    await this.sleep(90);
    this.press(false);
  }

  /** Waits, honoring speed-ups and skips. Throws if the swarm is torn down. */
  async sleep(ms: number) {
    this.check();
    if (this.clock.skipping() || ms <= 0) return;
    await new Promise((r) => setTimeout(r, ms / this.clock.speed()));
    this.check();
  }

  /** Halts any movement. A pending moveTo resolves where the agent stands. */
  stop() {
    this.moving?.stop();
    this.moving = null;
    this.releaseMove?.();
    this.releaseMove = null;
    this.stopNudges();
  }
}
