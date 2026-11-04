"use client";

import { useEffect, useMemo } from "react";
import { VISITOR_SEED_KEY } from "@/components/prefs/keys";
import { readStored, useStored, writeStored } from "@/components/prefs/storage";
import { randomSeed } from "@/lib/rng";
import { createVisitorIdentity, type VisitorIdentity } from "@/lib/visitor";

function parseSeed(raw: string | null): string {
  return raw && /^\d+$/.test(raw) ? raw : "";
}

/**
 * The visitor keeps the same name and color across visits on this device.
 * Returns null until the identity exists on the client.
 */
export function useVisitorIdentity(): VisitorIdentity | null {
  const [seed] = useStored(VISITOR_SEED_KEY, parseSeed, "");

  useEffect(() => {
    if (!parseSeed(readStored(VISITOR_SEED_KEY))) {
      writeStored(VISITOR_SEED_KEY, String(randomSeed()));
    }
  }, []);

  return useMemo(() => (seed ? createVisitorIdentity(Number(seed)) : null), [seed]);
}
