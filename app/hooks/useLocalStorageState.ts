import { useState, useEffect, useRef } from "react";

interface Options {
  /** When set, the effective storage key becomes `${key}-${room}`, and the value
   *  re-hydrates whenever the room changes (so a room switch loads that room's value). */
  room?: string;
}

// useState that persists to localStorage under `key` (optionally room-scoped). The
// stored value is JSON, so any serialisable T works. Hydrates lazily on mount and
// re-reads whenever the effective key changes; corrupt/empty storage falls back to
// `initial`. Single-tab only (no cross-tab sync).
export function useLocalStorageState<T>(key: string, initial: T, opts?: Options): [T, (value: T) => void] {
  const storageKey = opts?.room != null ? `${key}-${opts.room}` : key;

  const read = (k: string): T => {
    try {
      const stored = localStorage.getItem(k);
      return stored !== null ? (JSON.parse(stored) as T) : initialRef.current;
    } catch {
      return initialRef.current;
    }
  };

  // `initial` is read through a ref so the re-hydration effect can depend on the key
  // alone without re-running when a caller passes a fresh initial value each render.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const [value, setValue] = useState<T>(() => read(storageKey));

  useEffect(() => {
    setValue(read(storageKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore quota / unavailable-storage errors — state still updates in-memory.
    }
  };

  return [value, set];
}
