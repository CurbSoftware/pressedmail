export type ScreenshotMode = 'light' | 'dark';

export interface ScreenshotThemeSnapshot {
  bodyHasDarkClass: boolean;
  htmlHasDarkClass: boolean;
  prefersDarkMedia: boolean;
}

export interface ScreenshotModeState {
  mode: ScreenshotMode;
  hasManualOverride: boolean;
}

export function resolveScreenshotModeFromTheme({
  bodyHasDarkClass,
  htmlHasDarkClass,
  prefersDarkMedia,
}: ScreenshotThemeSnapshot): ScreenshotMode {
  return bodyHasDarkClass || htmlHasDarkClass || prefersDarkMedia
    ? 'dark'
    : 'light';
}

export function getNextScreenshotMode(mode: ScreenshotMode): ScreenshotMode {
  return mode === 'dark' ? 'light' : 'dark';
}

export function getScreenshotModeButtonLabel(mode: ScreenshotMode): string {
  return `Show ${getNextScreenshotMode(mode)} screenshot`;
}

export function syncScreenshotModeWithTheme({
  currentMode,
  preferredMode,
  hasManualOverride,
}: {
  currentMode: ScreenshotMode;
  preferredMode: ScreenshotMode;
  hasManualOverride: boolean;
}): ScreenshotModeState {
  if (hasManualOverride) {
    return {
      mode: currentMode,
      hasManualOverride,
    };
  }

  return {
    mode: preferredMode,
    hasManualOverride,
  };
}

export function getPreferredScreenshotMode(): ScreenshotMode {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const prefersDarkMedia =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return resolveScreenshotModeFromTheme({
    bodyHasDarkClass: document.body.classList.contains('dark'),
    htmlHasDarkClass: document.documentElement.classList.contains('dark'),
    prefersDarkMedia,
  });
}
