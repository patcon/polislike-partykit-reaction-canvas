import { useState } from "react";

// useState that persists to localStorage under `key`. The stored value is JSON,
// so any serialisable T works. Hydrates lazily on mount; corrupt/empty storage
// falls back to `initial`. Single-tab only (no cross-tab sync).
export function useLocalStorageState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Ignore quota / unavailable-storage errors — state still updates in-memory.
    }
  };

  return [value, set];
}
