import { useEffect, useState } from "react";
import { getState, PluginState } from "./backend";

interface Store {
  state: PluginState | null;
  activeGame: string | null;
}

let store: Store = { state: null, activeGame: null };
const listeners = new Set<() => void>();

function update(patch: Partial<Store>) {
  store = { ...store, ...patch };
  listeners.forEach((listener) => listener());
}

export function currentState(): PluginState | null {
  return store.state;
}

export async function refresh() {
  update({ state: await getState() });
}

export function setActiveGame(name: string | null) {
  update({ activeGame: name });
}

export function providerName(state: PluginState): string {
  return state.providers.find((provider) => provider.id === state.provider)?.name ?? "the cloud";
}

export function useStore(): Store {
  const [snapshot, setSnapshot] = useState(store);

  useEffect(() => {
    const listener = () => setSnapshot(store);
    listeners.add(listener);
    if (!store.state) refresh();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return snapshot;
}
