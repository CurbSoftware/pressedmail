import { injectVariables } from '../css/variable-injector';
import type { ThemeColorVariables } from '../types/colors';
import type { SemanticFontSizeId } from '../types/fonts';
import type { ResolvedAppearanceMode } from '../types/preferences';

export interface AppearanceTargets {
  roots: () => Iterable<HTMLElement>;
  portals?: () => Iterable<HTMLElement>;
  /** Subscribe to dynamic target changes such as newly mounted portals. */
  subscribe?: (onTargetsChanged: () => void) => () => void;
}

export interface AppearanceTargetState {
  themeId: string;
  themeClass: string;
  mode: ResolvedAppearanceMode;
  fontId: string;
  fontFamily: string;
  fontSizeId: SemanticFontSizeId;
  fontSizeValue: `${number}px`;
  variables: ThemeColorVariables;
}

const APPEARANCE_ATTRIBUTES = [
  'data-appearance-theme',
  'data-appearance-mode',
  'data-appearance-font',
  'data-appearance-size',
] as const;

const TYPOGRAPHY_PROPERTIES = [
  '--theme-font-family',
  '--theme-font-size',
  'font-family',
  'font-size',
  'color-scheme',
] as const;

interface ElementSnapshot {
  element: HTMLElement;
  attributes: Map<string, string | null>;
  properties: Map<string, { value: string; priority: string }>;
  themeClasses: Map<string, boolean>;
  hadDarkClass: boolean;
}

function currentTargets(targets: AppearanceTargets): {
  roots: HTMLElement[];
  portals: HTMLElement[];
  all: HTMLElement[];
} {
  const roots = Array.from(targets.roots());
  const portals = Array.from(targets.portals?.() ?? []);
  return { roots, portals, all: [...new Set([...roots, ...portals])] };
}

function applyCurrentTargets(
  state: AppearanceTargetState,
  targets: AppearanceTargets,
): () => void {
  const { roots, portals, all } = currentTargets(targets);
  const themeClasses = state.themeClass.split(/\s+/).filter(Boolean);
  const snapshots: ElementSnapshot[] = all.map((element) => ({
    element,
    attributes: new Map(
      APPEARANCE_ATTRIBUTES.map((attribute) => [
        attribute,
        element.getAttribute(attribute),
      ]),
    ),
    properties: new Map(
      TYPOGRAPHY_PROPERTIES.map((property) => [
        property,
        {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property),
        },
      ]),
    ),
    themeClasses: new Map(
      themeClasses.map((themeClass) => [
        themeClass,
        element.classList.contains(themeClass),
      ]),
    ),
    hadDarkClass: element.classList.contains('dark'),
  }));
  const cleanupVariables = injectVariables(state.variables, { roots, portals });

  all.forEach((element) => {
    element.setAttribute('data-appearance-theme', state.themeId);
    element.setAttribute('data-appearance-mode', state.mode);
    element.setAttribute('data-appearance-font', state.fontId);
    element.setAttribute('data-appearance-size', state.fontSizeId);
    themeClasses.forEach((themeClass) => element.classList.add(themeClass));
    element.classList.toggle('dark', state.mode === 'dark');
    element.style.setProperty('--theme-font-family', state.fontFamily);
    element.style.setProperty('--theme-font-size', state.fontSizeValue);
    element.style.setProperty('font-family', state.fontFamily);
    element.style.setProperty('font-size', state.fontSizeValue);
    element.style.setProperty('color-scheme', state.mode);
  });

  return () => {
    cleanupVariables();
    snapshots.forEach((snapshot) => {
      snapshot.attributes.forEach((value, attribute) => {
        if (value === null) snapshot.element.removeAttribute(attribute);
        else snapshot.element.setAttribute(attribute, value);
      });
      snapshot.properties.forEach(({ value, priority }, property) => {
        if (value)
          snapshot.element.style.setProperty(property, value, priority);
        else snapshot.element.style.removeProperty(property);
      });
      snapshot.themeClasses.forEach((wasPresent, themeClass) => {
        snapshot.element.classList.toggle(themeClass, wasPresent);
      });
      snapshot.element.classList.toggle('dark', snapshot.hadDarkClass);
    });
  };
}

/**
 * Mount appearance on explicit roots and portals, refreshing dynamic targets
 * and restoring all prior attributes, classes, and inline values on cleanup.
 */
export function mountAppearanceTargets(
  state: AppearanceTargetState,
  targets: AppearanceTargets,
): () => void {
  let cleanupTargets = applyCurrentTargets(state, targets);
  const unsubscribe = targets.subscribe?.(() => {
    cleanupTargets();
    cleanupTargets = applyCurrentTargets(state, targets);
  });

  return () => {
    unsubscribe?.();
    cleanupTargets();
  };
}
