import type { ReactNode } from 'react';

import { cn } from '#utils';

interface GradientBorderFrameProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Adds a soft primary glow behind the frame. */
  glow?: boolean;
}

/**
 * Wraps a visual (screenshot, mockup) in a thin token-driven gradient border.
 * Server-safe; complements MarketingScreenshotFrame rather than replacing it.
 */
export function GradientBorderFrame({
  children,
  className,
  innerClassName,
  glow = false,
}: GradientBorderFrameProps) {
  return (
    <div className={cn('relative', className)}>
      {glow ? (
        <div
          aria-hidden="true"
          className="absolute -inset-6 -z-10 rounded-[28px] blur-2xl"
          style={{
            background:
              'radial-gradient(ellipse at center, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%)',
          }}
        />
      ) : null}

      <div
        data-testid="gradient-border-frame"
        className="rounded-xl p-px"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in oklab, var(--primary) 36%, transparent), color-mix(in oklab, var(--border) 70%, transparent) 45%, color-mix(in oklab, var(--primary) 22%, transparent))',
        }}
      >
        <div
          className={cn(
            'bg-card overflow-hidden rounded-[calc(0.75rem-1px)]',
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
