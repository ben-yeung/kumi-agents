import type { AgentId } from "@/lib/agents";
import type { BuildKind } from "@/components/swarm/types";

export const BUILD_ADD_EVENT = "kumi:build-add";
export const CREW_ERRAND_EVENT = "kumi:errand";
export const SECTION_BUILT_EVENT = "kumi:section-built";
export const SWARM_REPLAY_EVENT = "kumi:replay";
export const WORKLOG_LIST_ID = "worklog";

/**
 * Data attributes that mark an element as something the crew builds.
 * Server-safe: sections stay server components and the engine reads these.
 */
export function build(
  kind: BuildKind,
  label: string,
  opts: { id?: string; agent?: AgentId; after?: string[]; pace?: number } = {},
): Record<string, string> {
  const attrs: Record<string, string> = { "data-build": kind, "data-build-label": label };
  if (opts.id) attrs["data-build-id"] = opts.id;
  if (opts.agent) attrs["data-build-agent"] = opts.agent;
  if (opts.after?.length) attrs["data-build-after"] = opts.after.join(",");
  if (opts.pace) attrs["data-build-pace"] = String(opts.pace);
  return attrs;
}

/** Marks a region whose builds activate together when it scrolls into view. */
export function buildSection(name: string): Record<string, string> {
  return { "data-build-section": name };
}
