import { AGENTS, type AgentId } from "@/lib/agents";
import type { Rng } from "@/lib/rng";

export type LogEntry = { id: string; time: string; agent: AgentId; text: string };

/** Seed entries for the work log; more are written live while it is read. */
export const WORKLOG: readonly LogEntry[] = [
  { id: "w1", time: "09:02", agent: "ren", text: "cut the brief into six pieces" },
  { id: "w2", time: "09:03", agent: "juno", text: "took the payments docs, reading slowly" },
  { id: "w3", time: "09:03", agent: "sol", text: "started a first pass on the welcome email" },
  {
    id: "w4",
    time: "09:11",
    agent: "mika",
    text: "found two flaky tests, both waiting on a clock",
  },
  {
    id: "w5",
    time: "09:14",
    agent: "bea",
    text: "drew the settings page, three columns became two",
  },
  { id: "w6", time: "09:20", agent: "oki", text: "tidied imports left behind by ren" },
  { id: "w7", time: "09:26", agent: "ivo", text: "aligned spacing across the new screens" },
  {
    id: "w8",
    time: "09:31",
    agent: "tao",
    text: "checked the pieces against each other, all fit",
  },
];

/** Things each agent tends to write, in keeping with their temperament. */
const NOTES: Record<AgentId, readonly string[]> = {
  ren: [
    "sketched the next piece: search",
    "laid groundwork for the import flow",
    "split the export job into three pieces",
  ],
  sol: [
    "rewrote the empty state, kinder now",
    "trimmed the release notes by half",
    "found a plainer word for 'provision'",
  ],
  ivo: [
    "measured the cards, nudged two by a pixel",
    "lined the table up with the grid",
    "evened out the rhythm of the headings",
  ],
  mika: [
    "reviewed sol's copy, two small notes",
    "added a test for the timezone edge",
    "caught a missing loading state",
  ],
  juno: [
    "wandered into the webhook retries, worth a look",
    "read the rate limit docs twice",
    "left a note about an older API version",
  ],
  oki: [
    "swept up three unused helpers",
    "renamed a confusing flag",
    "closed the loose ends from this morning",
  ],
  bea: [
    "drew the onboarding in four broad strokes",
    "boxed out the pricing page",
    "roughed in the mobile layout",
  ],
  tao: [
    "signed off the settings piece",
    "joined two pieces, clean fit",
    "marked the import flow as ready",
  ],
};

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The next live note: a different agent from the last one, a time a few
 * minutes on, and a line they have not written yet in this session.
 */
export function nextLogEntry(rng: Rng, previous: readonly LogEntry[]): LogEntry {
  const last = previous[previous.length - 1];
  const used = new Set(previous.map((e) => e.text));
  const candidates = AGENTS.filter(
    (a) => a.id !== last?.agent && NOTES[a.id].some((n) => !used.has(n)),
  );
  const who = rng.pick(candidates.length ? candidates : AGENTS).id;
  const fresh = NOTES[who].filter((n) => !used.has(n));
  return {
    id: `live-${previous.length}`,
    time: addMinutes(last?.time ?? "09:00", rng.int(2, 9)),
    agent: who,
    text: rng.pick(fresh.length ? fresh : NOTES[who]),
  };
}
