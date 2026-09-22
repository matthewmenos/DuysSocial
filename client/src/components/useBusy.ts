import { useState, useCallback } from "react";

/**
 * Tracks in-flight async work so buttons can disable + spinner.
 * `run` stays referentially stable; ignores overlapping calls.
 */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
