import { createElement, Fragment, type ComponentType } from "react";

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
