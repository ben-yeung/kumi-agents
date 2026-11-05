import type { AgentId } from "@/lib/agents";
import type { Rng } from "@/lib/rng";

export type LogEntry = { id: string; time: string; agent: AgentId; text: string };

/** The afternoon so far: seed entries for the work log. */
export const WORKLOG: readonly LogEntry[] = [
  { id: "w1", time: "13:02", agent: "ren", text: "cut team billing into eight pieces" },
  {
    id: "w2",
    time: "13:06",
    agent: "juno",
    text: "compared two payment providers, chose the simpler one",
  },
  {
    id: "w3",
    time: "13:14",
    agent: "oki",
    text: "listed everything still using the old invoices",
  },
  { id: "w4", time: "13:21", agent: "bea", text: "wired checkout to ren's new schema" },
  {
    id: "w5",
    time: "13:28",
    agent: "mika",
    text: "caught a double charge on webhook retry, fixed it",
  },
  { id: "w6", time: "13:35", agent: "sol", text: "settled the plan names with bea" },
  {
    id: "w7",
    time: "13:41",
    agent: "ivo",
    text: "replayed a month of usage, totals drifted by 3 cents",
  },
  {
    id: "w8",
    time: "13:47",
    agent: "tao",
    text: "lined up the merge order, ren's schema goes first",
  },
];

/** The rest of the afternoon, written live in this order, ending with the release. */
export const LIVE_NOTES: readonly { agent: AgentId; text: string }[] = [
  { agent: "juno", text: "wrote up the webhook gotchas, left them for mika" },
  { agent: "ren", text: "backfilled every existing team, no gaps" },
  { agent: "bea", text: "added seat management, mobile included" },
  { agent: "mika", text: "covered mid-cycle upgrades, suite is green" },
  { agent: "sol", text: "softened the failed-card email, cut it by a third" },
  { agent: "ivo", text: "traced the 3 cents to rounding, invoices now match" },
  { agent: "oki", text: "moved the old plans over, removed the dead routes" },
  { agent: "tao", text: "joined all eight pieces, rolled out behind a flag" },
];

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** The next live note, a few minutes after the last one; null once the work is done. */
export function nextLogEntry(rng: Rng, previous: readonly LogEntry[]): LogEntry | null {
  const note = LIVE_NOTES[previous.length - WORKLOG.length];
  if (!note) return null;
  const last = previous[previous.length - 1];
  return {
    ...note,
    id: `live-${previous.length}`,
    time: addMinutes(last.time, rng.int(2, 9)),
  };
}
