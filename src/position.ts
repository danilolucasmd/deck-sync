import { RefObject, useLayoutEffect, useRef } from "react";

// Module state, because the panel remounts whenever a modal or dropdown opens.
let lastView: string | null = null;
let mainScrollTop = 0;
let returnTarget: string | null = null;

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

function focus(root: HTMLElement | null, selector: string) {
  requestAnimationFrame(() => {
    const target = root?.querySelector<HTMLElement>(selector) ?? root?.querySelector<HTMLElement>("button");
    target?.focus({ preventScroll: true });
  });
}

export function rememberMainPosition(anchor: RefObject<HTMLElement | null>, target: string) {
  mainScrollTop = scrollParent(anchor.current)?.scrollTop ?? 0;
  returnTarget = target;
}

export function useViewPosition(view: string): RefObject<HTMLDivElement | null> {
  const anchor = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (view === lastView) return;
    const entering = lastView !== null;
    lastView = view;
    if (!entering) return;

    const root = anchor.current;
    const parent = scrollParent(root);
    if (view === "main") {
      if (parent) parent.scrollTop = mainScrollTop;
      focus(root, `[data-return-target="${returnTarget}"] button`);
    } else {
      if (parent) parent.scrollTop = 0;
      focus(root, "button");
    }
  }, [view]);

  return anchor;
}
