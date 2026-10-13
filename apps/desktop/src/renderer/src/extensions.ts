import { createElement, Fragment, type ComponentType } from "react";

/**
 * Components a host mounts inside the app, under the store's provider, without editing App.
 *
 * Realm (Carlton Aikins, github.com/31Carlton7/realm) renders nothing from here by itself. A host
 * that serves this renderer outside Electron registers before `main.tsx` runs, and its component
 * reads the same store every pane does (`useAppStore`). The Chewbacca glass shows this app as it
 * ships and registers nothing by default; its older tiles-and-story layer, kept behind an opt-in,
 * plugs in here instead of replacing `StoreContext.Provider` from outside.
 */
const mounted: ComponentType[] = [];

export function registerExtension(component: ComponentType): void {
  if (!mounted.includes(component)) mounted.push(component);
}

export function Extensions() {
  return createElement(Fragment, null, ...mounted.map((C, i) => createElement(C, { key: i })));
}
