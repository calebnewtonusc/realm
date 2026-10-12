import { createElement, Fragment, useSyncExternalStore, type ComponentType } from "react";

/**
 * Components a host mounts inside the app, under the store's provider, without editing App.
 *
 * Realm (Carlton Aikins, github.com/31Carlton7/realm) renders nothing from here by itself. A host
 * that serves this renderer outside Electron registers before `main.tsx` runs, and its component
 * reads the same store every pane does (`useAppStore`). The Chewbacca glass is the one that does:
 * its agent tiles and stage are a layer over these panes, and this is the one place they plug in,
 * instead of replacing `StoreContext.Provider` from outside.
 */
const mounted: ComponentType[] = [];

export function registerExtension(component: ComponentType): void {
  if (!mounted.includes(component)) mounted.push(component);
}

export function Extensions() {
  return createElement(Fragment, null, ...mounted.map((C, i) => createElement(C, { key: i })));
}

/**
 * A host that has put the whole app out of sight (the Chewbacca glass while it shows its agent tiles
 * or its story of a turn) says so here, and QuietBridge in App.tsx treats it like a window without
 * the user's attention: the looping decoration pauses. The glass keeps this window focused while the
 * app is hidden under it, so blur/focus alone never said so, and about forty orb and shimmer loops ran
 * behind the tiles (headless WebKit, 2026-10-12: 40 in the empty state, 44 while an agent worked).
 */
let hostQuiet = false;
const quietListeners = new Set<() => void>();

export function setHostQuiet(quiet: boolean): void {
  if (quiet === hostQuiet) return;
  hostQuiet = quiet;
  for (const l of quietListeners) l();
}

export function useHostQuiet(): boolean {
  return useSyncExternalStore(
    (l) => { quietListeners.add(l); return () => { quietListeners.delete(l); }; },
    () => hostQuiet,
  );
}
