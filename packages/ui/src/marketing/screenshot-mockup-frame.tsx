'use client';

import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '#utils';

import {
  ThemedScreenshot,
  ThemedScreenshotModeButton,
  ThemedScreenshotModeProvider,
} from './themed-screenshot';

interface ScreenshotMockupFrameImage {
  basePath: string;
  alt: string;
  ext?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
}

interface ScreenshotMockupFrameProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  image?: ScreenshotMockupFrameImage;
  toolbarClassName?: string;
  contentClassName?: string;
  imageContainerClassName?: string;
  dotClassName?: string;
  labelClassName?: string;
  showModeButton?: boolean;
  /**
   * Optional max-width preset for the frame. Maps to the marketing design
   * system screenshot sizes:
   *
   * - `sm` → max-w-[360px] (callouts / collage tiles)
   * - `md` → max-w-[620px] (split sections)
   * - `lg` → max-w-[880px] (hero + tour large frames)
   *
   * Omitting the prop leaves the frame unconstrained, matching the legacy
   * behaviour so existing consumers (web-curbpress, web-pressednotes) are
   * not affected.
   */
  size?: 'sm' | 'md' | 'lg';
}

const SCREENSHOT_SIZE_CLASSNAME: Record<
  NonNullable<ScreenshotMockupFrameProps['size']>,
  string
> = {
  sm: 'mx-auto w-full max-w-[360px]',
  md: 'mx-auto w-full max-w-[620px]',
  lg: 'mx-auto w-full max-w-[880px]',
};

function ScreenshotMockupFrameContent({
  label = 'PressedMail',
  image,
  children,
  className,
  toolbarClassName,
  contentClassName,
  imageContainerClassName,
  dotClassName = 'h-2.5 w-2.5',
  labelClassName,
  showModeButton = true,
  size,
  ...props
}: ScreenshotMockupFrameProps) {
  return (
    <div
      {...props}
      className={cn(
        'overflow-hidden rounded-lg border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] shadow-[var(--shadow-screenshot)]',
        size ? SCREENSHOT_SIZE_CLASSNAME[size] : undefined,
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b border-[color:var(--surface-card-border)] bg-[var(--surface-elevated)] px-4 py-3',
          toolbarClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn('bg-destructive shrink-0 rounded-full', dotClassName)}
          />
          <span
            className={cn('shrink-0 rounded-full bg-amber-400', dotClassName)}
          />
          <span
            className={cn('shrink-0 rounded-full bg-emerald-500', dotClassName)}
          />
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'text-muted-foreground truncate text-xs font-medium',
              labelClassName,
            )}
          >
            {label}
          </span>
          {image && showModeButton ? (
            <ThemedScreenshotModeButton className="shrink-0" />
          ) : null}
        </div>
      </div>

      {image ? (
        <div
          className={cn(
            'relative overflow-hidden bg-[var(--surface-section)]',
            imageContainerClassName,
          )}
        >
          <ThemedScreenshot
            basePath={image.basePath}
            alt={image.alt}
            ext={image.ext}
            width={image.width}
            height={image.height}
            fill={image.fill}
            sizes={image.sizes}
            className={image.className}
            priority={image.priority}
          />
          {children}
        </div>
      ) : (
        <div className={cn('relative overflow-hidden', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function ScreenshotMockupFrame(props: ScreenshotMockupFrameProps) {
  if (props.image) {
    return (
      <ThemedScreenshotModeProvider>
        <ScreenshotMockupFrameContent {...props} />
      </ThemedScreenshotModeProvider>
    );
  }

  return <ScreenshotMockupFrameContent {...props} />;
}
