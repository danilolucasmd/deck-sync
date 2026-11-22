import { useEffect, useState } from "react";

// The Quick Access panel remounts whenever a modal or dropdown opens, so view state has to outlive it.
const drafts = new Map<string, unknown>();
const listeners = new Set<() => void>();

export function clearDrafts() {
  drafts.clear();
}

export function useDraft<T>(key: string, initial: T | (() => T)): [T, (value: T) => void] {
  if (!drafts.has(key)) {
    drafts.set(key, typeof initial === "function" ? (initial as () => T)() : initial);
  }
  const [value, setValue] = useState(drafts.get(key) as T);

  useEffect(() => {
    const listener = () => setValue(drafts.get(key) as T);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, [key]);

  const set = (next: T) => {
    drafts.set(key, next);
    listeners.forEach((listener) => listener());
  };
  return [value, set];
}
