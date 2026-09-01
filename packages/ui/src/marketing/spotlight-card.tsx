'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { cn } from '#utils';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** CSS color for the spotlight. Defaults to a soft primary-token glow. */
  spotlightColor?: string;
}

/**
 * Card surface with a cursor-following radial spotlight on hover.
 * Token-safe: the default spotlight derives from `--primary` via color-mix
 * (hsl over OKLCH tokens is a silent no-op. Never use it here.)
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = 'color-mix(in oklab, var(--primary) 14%, transparent)',
}: SpotlightCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  return (
    <div
      data-testid="spotlight-card"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        'border-border/60 bg-card/50 relative overflow-hidden rounded-lg border',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(420px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
