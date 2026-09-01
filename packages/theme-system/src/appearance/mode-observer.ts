import type {
  AppearanceMode,
  ResolvedAppearanceMode,
} from '../types/preferences';

export interface AppearanceMediaQuery {
  readonly matches: boolean;
  addEventListener(
    type: 'change',
    listener: (event: MediaQueryListEvent) => void,
  ): void;
  removeEventListener(
    type: 'change',
    listener: (event: MediaQueryListEvent) => void,
  ): void;
}

export type AppearanceMatchMedia = (query: string) => AppearanceMediaQuery;

export function resolveAppearanceMode(
  mode: AppearanceMode,
  systemIsDark: boolean,
): ResolvedAppearanceMode {
  if (mode === 'system') return systemIsDark ? 'dark' : 'light';
  return mode;
}

/** Observe the OS color scheme only when `system` mode is selected. */
export function observeAppearanceMode(
  mode: AppearanceMode,
  onChange: (mode: ResolvedAppearanceMode) => void,
  matchMedia: AppearanceMatchMedia = (query) => window.matchMedia(query),
): () => void {
  if (mode !== 'system') {
    onChange(mode);
    return () => {};
  }

  const media = matchMedia('(prefers-color-scheme: dark)');
  const notify = (matches: boolean) => onChange(matches ? 'dark' : 'light');
  const listener = (event: MediaQueryListEvent) => notify(event.matches);
  notify(media.matches);
  media.addEventListener('change', listener);

  return () => media.removeEventListener('change', listener);
}
