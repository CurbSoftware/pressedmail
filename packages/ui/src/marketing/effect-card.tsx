'use client';

import {
  type CSSProperties,
  type HTMLAttributes,
  memo,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import { animate } from 'framer-motion';

import { cn } from '../lib/utils';

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}

const GlowingEffect = memo(function GlowingEffect({
  blur = 0,
  inactiveZone = 0.7,
  proximity = 0,
  spread = 24,
  glow = false,
  className,
  movementDuration = 2,
  borderWidth = 1,
  disabled = true,
}: GlowingEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPosition = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);

  const handleMove = useCallback(
    (event?: MouseEvent | { x: number; y: number }) => {
      if (!containerRef.current) {
        return;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const element = containerRef.current;

        if (!element) {
          return;
        }

        const { left, top, width, height } = element.getBoundingClientRect();
        const mouseX = event?.x ?? lastPosition.current.x;
        const mouseY = event?.y ?? lastPosition.current.y;

        if (event) {
          lastPosition.current = { x: mouseX, y: mouseY };
        }

        const center = [left + width * 0.5, top + height * 0.5];
        const distanceFromCenter = Math.hypot(
          mouseX - (center[0] ?? 0),
          mouseY - (center[1] ?? 0),
        );
        const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

        if (distanceFromCenter < inactiveRadius) {
          element.style.setProperty('--active', '0');
          return;
        }

        const isActive =
          mouseX > left - proximity &&
          mouseX < left + width + proximity &&
          mouseY > top - proximity &&
          mouseY < top + height + proximity;

        element.style.setProperty('--active', isActive ? '1' : '0');

        if (!isActive) {
          return;
        }

        const currentAngle =
          parseFloat(element.style.getPropertyValue('--start')) || 0;
        const targetAngle =
          (180 *
            Math.atan2(mouseY - (center[1] ?? 0), mouseX - (center[0] ?? 0))) /
            Math.PI +
          90;

        const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
        const newAngle = currentAngle + angleDiff;

        animate(currentAngle, newAngle, {
          duration: movementDuration,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (value) => {
            element.style.setProperty('--start', String(value));
          },
        });
      });
    },
    [inactiveZone, movementDuration, proximity],
  );

  useEffect(() => {
    if (disabled) {
      return;
    }

    const handleScroll = () => handleMove();
    const handlePointerMove = (event: PointerEvent) => handleMove(event);

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.body.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      window.removeEventListener('scroll', handleScroll);
      document.body.removeEventListener('pointermove', handlePointerMove);
    };
  }, [disabled, handleMove]);

  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity',
          glow && 'opacity-100',
          disabled && '!block',
        )}
      />
      <div
        ref={containerRef}
        style={
          {
            '--blur': `${blur}px`,
            '--spread': spread,
            '--start': '0',
            '--active': '0',
            '--glowingeffect-border-width': `${borderWidth}px`,
            '--repeating-conic-gradient-times': '5',
            '--gradient': `radial-gradient(circle, color-mix(in oklch, var(--primary) 82%, transparent) 10%, transparent 23%),
              radial-gradient(circle at 40% 40%, color-mix(in oklch, var(--chart-2) 72%, transparent) 5%, transparent 18%),
              radial-gradient(circle at 60% 60%, color-mix(in oklch, var(--chart-3) 74%, transparent) 10%, transparent 23%),
              radial-gradient(circle at 40% 60%, color-mix(in oklch, var(--ring) 70%, transparent) 10%, transparent 23%),
              repeating-conic-gradient(
                from 236.84deg at 50% 50%,
                var(--primary) 0%,
                var(--chart-2) calc(25% / var(--repeating-conic-gradient-times)),
                var(--chart-3) calc(50% / var(--repeating-conic-gradient-times)),
                var(--ring) calc(75% / var(--repeating-conic-gradient-times)),
                var(--primary) calc(100% / var(--repeating-conic-gradient-times))
              )`,
          } as CSSProperties
        }
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity',
          glow && 'opacity-100',
          blur > 0 && 'blur-[var(--blur)]',
          className,
          disabled && '!hidden',
        )}
      >
        <div
          className={cn(
            'rounded-[inherit]',
            'after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))] after:rounded-[inherit] after:content-[""]',
            'after:[border:var(--glowingeffect-border-width)_solid_transparent]',
            'after:[background-attachment:fixed] after:[background:var(--gradient)]',
            'after:opacity-[var(--active)] after:transition-opacity after:duration-300',
            'after:[mask-clip:padding-box,border-box]',
            'after:[mask-composite:intersect]',
            'after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]',
          )}
        />
      </div>
    </>
  );
});

interface MarketingEffectCardProps extends HTMLAttributes<HTMLElement> {
  contentClassName?: string;
}

export function MarketingGlowingCard({
  className,
  contentClassName,
  children,
  ...props
}: MarketingEffectCardProps) {
  return (
    <article
      className={cn(
        'hover:border-primary/30 relative h-full overflow-hidden rounded-lg border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-chrome)] p-1.5 shadow-[var(--shadow-card)] transition-colors hover:shadow-[var(--shadow-elevated)]',
        className,
      )}
      {...props}
    >
      <GlowingEffect
        spread={40}
        glow
        disabled={false}
        proximity={80}
        inactiveZone={0.01}
      />
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-md bg-[var(--surface-elevated)] p-5 backdrop-blur-sm md:p-6',
          contentClassName,
        )}
      >
        {children}
      </div>
    </article>
  );
}

export { GlowingEffect };
