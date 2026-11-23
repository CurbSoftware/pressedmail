/**
 * The browser tab's title. ApplicationLayout is its one writer, and asks pageTitle():
 *
 *   1. the name a mounted screen asked for (useDocumentTitle), such as the open campaign's;
 *   2. else the route's own word for the Campaigns and Templates screens, translated;
 *   3. else the last path segment in start case, as every other screen has always had.
 *
 * A store and not an effect in the screen, because the layout's effect runs after its children's and would write
 * over them. The bare name, with no product or site suffix, like the rest of the app.
 */

import { useEffect, useSyncExternalStore } from "react";
import { __ } from "@wordpress/i18n";

const claims: { title: string }[] = [];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

/** The newest title a mounted screen asked for, or null. */
export const screenTitle = (): string | null =>
  claims[claims.length - 1]?.title ?? null;

/** The tab shows this while the component is mounted. Nothing, or a blank name, leaves the route's own title. */
export function useDocumentTitle(title: string | null | undefined): void {
  const name = title?.trim() ?? "";
  useEffect(() => {
    if (!name) return;
    const claim = { title: name };
    claims.push(claim);
    changed();
    return () => {
      claims.splice(claims.indexOf(claim), 1);
      changed();
    };
  }, [name]);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useScreenTitle = (): string | null =>
  useSyncExternalStore(subscribe, screenTitle, screenTitle);

const startCase = (str: string) =>
  str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .split(" ")
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Campaigns and Templates name themselves, whatever follows in the path: never "Wizard", "New" or a number. */
function routeTitle(segments: string[]): string | null {
  if (!__ENABLE_TEMPLATES__) return null;
  if (segments[0] === "campaigns") return __("Campaigns", "pressedmail");
  if (segments[0] !== "templates") return null;
  return segments[1] === "forms"
    ? __("Forms", "pressedmail")
    : __("Templates", "pressedmail");
}

export function pageTitle(pathname: string, screen: string | null): string {
  if (screen) return screen;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return routeTitle(segments) ?? (last ? startCase(last) : "Inbox");
}
