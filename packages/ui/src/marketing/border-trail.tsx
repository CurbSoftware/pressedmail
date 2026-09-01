'use client';

import { type CSSProperties } from 'react';

import { motion } from 'framer-motion';

import { cn } from '#utils';

interface BorderTrailProps {
  className?: string;
  size?: number;
  cornerRadius?: number;
  duration?: number;
  delay?: number;
  style?: CSSProperties;
}

/**
 * Animated dot that traces the border of its parent container.
 * Parent must have `position: relative` and `overflow: hidden`.
 */
export function BorderTrail({
  className,
  size = 60,
  cornerRadius = 16,
  duration = 8,
  delay = 0,
  style,
}: BorderTrailProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <motion.div
        className={cn(
          'absolute h-[2px] rounded-full',
          'via-primary bg-gradient-to-r from-transparent to-transparent',
          className,
        )}
        style={{
          width: size,
          offsetPath: `rect(0 auto auto 0 round ${cornerRadius}px)`,
          ...style,
        }}
        animate={{
          offsetDistance: ['0%', '100%'],
        }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}
