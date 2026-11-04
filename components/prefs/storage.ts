"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store shared across components. Reads are
 * hydration-safe: the server snapshot is always the fallback.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Fallback for when localStorage throws (blocked storage, some private modes).
const memory = new Map<string, string>();

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeStored(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Memory fallback above keeps the UI consistent for this page view.
  }
  listeners.forEach((l) => l());
}

export function useStored<T extends string>(
  key: string,
  parse: (raw: string | null) => T,
  serverValue: T,
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => parse(readStored(key)),
    () => serverValue,
  );
  const set = useCallback((next: T) => writeStored(key, next), [key]);
  return [value, set];
}
