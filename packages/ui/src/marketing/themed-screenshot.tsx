'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import Image from 'next/image';

import { cn } from '#utils';
import { Moon, Sun } from 'lucide-react';

import { getStorageImageLoaderProps } from '@kit/shared/storage/media-url';

import {
  getNextScreenshotMode,
  getPreferredScreenshotMode,
  getScreenshotModeButtonLabel,
  syncScreenshotModeWithTheme,
} from './themed-screenshot-mode';
import type {
  ScreenshotMode,
  ScreenshotModeState,
} from './themed-screenshot-mode';

interface ThemedScreenshotModeController {
  mode: ScreenshotMode;
  hasManualOverride: boolean;
  toggleMode: () => void;
}

const ThemedScreenshotModeContext =
  createContext<ThemedScreenshotModeController | null>(null);

interface ThemedScreenshotProps {
  basePath: string;
  ext?: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

interface ThemedScreenshotImagesProps extends ThemedScreenshotProps {
  controller: ThemedScreenshotModeController;
}

interface ThemedScreenshotModeButtonProps {
  className?: string;
}

function useThemedScreenshotModeController(): ThemedScreenshotModeController {
  const [modeState, setModeState] = useState<ScreenshotModeState>({
    mode: 'light',
    hasManualOverride: false,
  });

  useEffect(() => {
    const syncWithTheme = () => {
      const preferredMode = getPreferredScreenshotMode();

      setModeState((current) =>
        syncScreenshotModeWithTheme({
          currentMode: current.mode,
          preferredMode,
          hasManualOverride: current.hasManualOverride,
        }),
      );
    };

    syncWithTheme();

    const observer = new MutationObserver(syncWithTheme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    observer.observe(document.documentElement, {
      attributeFilter: ['class'],
      attributes: true,
    });
    observer.observe(document.body, {
      attributeFilter: ['class'],
      attributes: true,
    });
    mediaQuery.addEventListener('change', syncWithTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', syncWithTheme);
    };
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const currentMode = current.hasManualOverride
        ? current.mode
        : getPreferredScreenshotMode();

      return {
        mode: getNextScreenshotMode(currentMode),
        hasManualOverride: true,
      };
    });
  }, []);

  return useMemo(
    () => ({
      mode: modeState.mode,
      hasManualOverride: modeState.hasManualOverride,
      toggleMode,
    }),
    [modeState.hasManualOverride, modeState.mode, toggleMode],
  );
}

export function ThemedScreenshotModeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const controller = useThemedScreenshotModeController();

  return (
    <ThemedScreenshotModeContext.Provider value={controller}>
      {children}
    </ThemedScreenshotModeContext.Provider>
  );
}

export function ThemedScreenshotModeButton({
  className,
}: ThemedScreenshotModeButtonProps) {
  const context = useContext(ThemedScreenshotModeContext);

  if (!context) {
    return null;
  }

  const isDarkSelected = context.mode === 'dark';

  return (
    <button
      type="button"
      aria-label={getScreenshotModeButtonLabel(context.mode)}
      aria-pressed={isDarkSelected}
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      onClick={context.toggleMode}
    >
      {isDarkSelected ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}

export function ThemedScreenshot({ ...props }: ThemedScreenshotProps) {
  const contextController = useContext(ThemedScreenshotModeContext);

  if (contextController) {
    return <ThemedScreenshotImages {...props} controller={contextController} />;
  }

  return <ThemedScreenshotStandalone {...props} />;
}

function ThemedScreenshotStandalone(props: ThemedScreenshotProps) {
  const controller = useThemedScreenshotModeController();

  return <ThemedScreenshotImages {...props} controller={controller} />;
}

function ThemedScreenshotImages({
  basePath,
  ext = 'png',
  alt,
  width,
  height,
  fill,
  sizes,
  className,
  priority,
  controller,
}: ThemedScreenshotImagesProps) {
  const shared = {
    sizes,
    priority,
    ...(fill ? { fill: true as const } : { width, height }),
  };
  const lightSrc = `${basePath}-light.${ext}`;
  const darkSrc = `${basePath}-dark.${ext}`;
  const lightImageLoaderProps = getStorageImageLoaderProps(lightSrc);
  const darkImageLoaderProps = getStorageImageLoaderProps(darkSrc);
  const manuallySelectedMode = controller.hasManualOverride
    ? controller.mode
    : null;

  return (
    <>
      <Image
        {...lightImageLoaderProps}
        src={lightSrc}
        alt={alt}
        className={cn(
          className,
          manuallySelectedMode === 'light' && 'block',
          manuallySelectedMode === 'dark' && 'hidden',
          manuallySelectedMode === null && 'dark:hidden',
        )}
        {...shared}
      />
      <Image
        {...darkImageLoaderProps}
        src={darkSrc}
        alt={alt}
        className={cn(
          className,
          manuallySelectedMode === 'light' && 'hidden',
          manuallySelectedMode === 'dark' && 'block',
          manuallySelectedMode === null && 'hidden dark:block',
        )}
        {...shared}
      />
    </>
  );
}
