'use client';

import { type ReactNode, useEffect, useId, useMemo, useRef } from 'react';

import {
  type MotionValue,
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';

import { cn } from '../lib/utils';

type MarketingHeroShaderBackgroundProps = {
  variant?: 'hero' | 'header';
  followerTone?: 'primary' | 'background';
  className?: string;
  /**
   * Optional node rendered centered (with padding) inside the mouse-following
   * element. When provided, the default logo-shaped mask is dropped and the
   * follower becomes a soft rounded chip hosting this content. Omit to keep the
   * legacy mask-shaped follower (current behavior for sites without a logo).
   */
  followerLogo?: ReactNode;
};

// Per-product override via CSS variable; falls back to the PressedMail mark so
// existing sites are unchanged. Products set `--marketing-hero-logo-mask` to
// their own mask (see each app's global styles).
const LOGO_MASK =
  'var(--marketing-hero-logo-mask, url("/images/brand/pressedmail-horizontal-launch-icon.svg"))';
const LOGO_ICON_ASPECT_RATIO = 898 / 768;

export function MarketingHeroShaderBackground({
  variant = 'hero',
  followerTone = 'primary',
  className,
  followerLogo,
}: MarketingHeroShaderBackgroundProps) {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const gridPatternId = useId().replace(/:/g, '');

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  const isHeader = variant === 'header';
  const gridSize = isHeader ? 40 : 48;
  const logoMaskWidth = isHeader ? 480 : 680;
  const logoMaskHeight = logoMaskWidth / LOGO_ICON_ASPECT_RATIO;
  const haloSize = isHeader ? 460 : 620;
  const followerLogoWidth = isHeader ? 270 : 360;
  const followerLogoHeight = followerLogoWidth / LOGO_ICON_ASPECT_RATIO;
  const offsetSpeedX = isHeader ? 0.17 : 0.22;
  const offsetSpeedY = isHeader ? 0.13 : 0.19;

  const logoHalfWidth = logoMaskWidth / 2;
  const logoHalfHeight = logoMaskHeight / 2;
  const canTrackPointer = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }, []);

  useEffect(() => {
    const element = backgroundRef.current;

    if (!element) {
      return;
    }

    const setCenter = () => {
      const rect = element.getBoundingClientRect();
      mouseX.set(rect.width / 2);
      mouseY.set(rect.height / 2);
    };

    setCenter();

    if (!canTrackPointer || shouldReduceMotion) {
      window.addEventListener('resize', setCenter);

      return () => {
        window.removeEventListener('resize', setCenter);
      };
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const boundedX = Math.max(0, Math.min(rect.width, x));
      const boundedY = Math.max(0, Math.min(rect.height, y));

      mouseX.set(boundedX);
      mouseY.set(boundedY);
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    window.addEventListener('resize', setCenter);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', setCenter);
    };
  }, [canTrackPointer, mouseX, mouseY, shouldReduceMotion]);

  useAnimationFrame(() => {
    if (shouldReduceMotion) {
      return;
    }

    gridOffsetX.set((gridOffsetX.get() + offsetSpeedX) % gridSize);
    gridOffsetY.set((gridOffsetY.get() + offsetSpeedY) % gridSize);
  });

  const revealMaskImage = useMotionTemplate`radial-gradient(${haloSize}px circle at ${mouseX}px ${mouseY}px, rgba(0, 0, 0, 0.98), rgba(0, 0, 0, 0.8) 46%, transparent 75%), ${LOGO_MASK}`;
  const revealMaskSize = `100% 100%, ${logoMaskWidth}px ${logoMaskHeight}px`;
  const revealMaskPosition = useMotionTemplate`0 0, calc(${mouseX}px - ${logoHalfWidth}px) calc(${mouseY}px - ${logoHalfHeight}px)`;

  return (
    <div
      ref={backgroundRef}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 z-0 overflow-hidden',
        className,
      )}
    >
      <div className="bg-background absolute inset-0" />

      <div
        className={cn(
          'text-border absolute inset-0',
          isHeader ? 'opacity-[0.12]' : 'opacity-[0.14]',
        )}
      >
        <GridPattern
          patternId={gridPatternId}
          gridSize={gridSize}
          offsetX={gridOffsetX}
          offsetY={gridOffsetY}
        />
      </div>

      <motion.div
        className={cn(
          'text-primary absolute inset-0',
          isHeader ? 'opacity-45' : 'opacity-50',
        )}
        style={{
          maskImage: revealMaskImage,
          WebkitMaskImage: revealMaskImage,
          maskSize: revealMaskSize,
          WebkitMaskSize: revealMaskSize,
          maskPosition: revealMaskPosition,
          WebkitMaskPosition: revealMaskPosition,
          maskRepeat: 'no-repeat, no-repeat',
          WebkitMaskRepeat: 'no-repeat, no-repeat',
        }}
      >
        <GridPattern
          patternId={`${gridPatternId}-reveal`}
          gridSize={gridSize}
          offsetX={gridOffsetX}
          offsetY={gridOffsetY}
        />
      </motion.div>

      <div className="absolute inset-0">
        <div className="bg-primary/13 absolute -top-24 right-[-8rem] h-[24rem] w-[24rem] rounded-full blur-[130px]" />
        <div className="bg-accent/40 absolute -bottom-24 left-[-6rem] h-[22rem] w-[22rem] rounded-full blur-[130px]" />
        <div className="bg-ring/20 absolute top-12 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-[95px]" />
      </div>

      <motion.div
        className={cn(
          'absolute shadow-sm',
          followerTone === 'background'
            ? 'bg-primary/13 dark:bg-primary/13'
            : 'bg-primary/13 dark:bg-primary/13 brightness-125 saturate-150 dark:brightness-55 dark:saturate-90',
          followerLogo &&
            'flex items-center justify-center rounded-[28%] ring-1 ring-primary/20',
        )}
        style={{
          left: mouseX,
          top: mouseY,
          width: followerLogoWidth,
          height: followerLogoHeight,
          translateX: '-50%',
          translateY: '-50%',
          ...(followerLogo
            ? {}
            : {
                maskImage: LOGO_MASK,
                WebkitMaskImage: LOGO_MASK,
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
              }),
        }}
      >
        {followerLogo ? (
          <div className="flex h-full w-full items-center justify-center p-[6%]">
            {followerLogo}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

function GridPattern({
  patternId,
  gridSize,
  offsetX,
  offsetY,
}: {
  patternId: string;
  gridSize: number;
  offsetX: MotionValue<number>;
  offsetY: MotionValue<number>;
}) {
  return (
    <svg className="h-full w-full">
      <defs>
        <motion.pattern
          id={patternId}
          width={gridSize}
          height={gridSize}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
          />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
