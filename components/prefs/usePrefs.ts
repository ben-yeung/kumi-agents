"use client";

import { TAG_MODE_KEY } from "@/components/prefs/keys";
import { useStored } from "@/components/prefs/storage";

/** "actions" shows `name · what they are doing`; "names" shows only the name. */
export type TagMode = "actions" | "names";

function parseTagMode(raw: string | null): TagMode {
  return raw === "names" ? "names" : "actions";
}

export function useTagMode() {
  return useStored<TagMode>(TAG_MODE_KEY, parseTagMode, "actions");
}
