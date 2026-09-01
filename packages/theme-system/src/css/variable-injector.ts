/** Product-neutral CSS-variable injection for explicit appearance targets. */
import type { ThemeColorVariables } from '../types/colors';

export interface VariableTargets {
  roots: Iterable<HTMLElement>;
  portals?: Iterable<HTMLElement>;
}

interface PropertySnapshot {
  key: string;
  value: string;
  priority: string;
}

function uniqueTargets(targets: VariableTargets): HTMLElement[] {
  return [
    ...new Set([
      ...Array.from(targets.roots),
      ...Array.from(targets.portals ?? []),
    ]),
  ];
}

/**
 * Apply variables only to the supplied roots and portals.
 *
 * The returned cleanup restores each prior inline value and priority, allowing
 * multiple scoped products to coexist in one WordPress document.
 */
export function injectVariables(
  variables: ThemeColorVariables,
  targets: VariableTargets,
): () => void {
  const elements = uniqueTargets(targets);
  const variableEntries = Object.entries(variables).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  const snapshots = new Map<HTMLElement, PropertySnapshot[]>();

  elements.forEach((element) => {
    snapshots.set(
      element,
      variableEntries.map(([key]) => ({
        key,
        value: element.style.getPropertyValue(key),
        priority: element.style.getPropertyPriority(key),
      })),
    );
    variableEntries.forEach(([key, value]) =>
      element.style.setProperty(key, value),
    );
  });

  return () => {
    snapshots.forEach((properties, element) => {
      properties.forEach(({ key, value, priority }) => {
        if (value) {
          element.style.setProperty(key, value, priority);
        } else {
          element.style.removeProperty(key);
        }
      });
    });
  };
}

/** Clear selected variables only from supplied roots and portals. */
export function clearVariables(
  variableKeys: readonly string[],
  targets: VariableTargets,
): void {
  uniqueTargets(targets).forEach((element) => {
    variableKeys.forEach((key) => element.style.removeProperty(key));
  });
}
