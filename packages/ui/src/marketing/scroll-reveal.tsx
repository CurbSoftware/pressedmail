'use client';

import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '#utils';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before the reveal starts. Use for staggering siblings. */
  delay?: number;
  /** Vertical rise distance in px. Set 0 for a pure fade. */
  y?: number;
}

/**
 * Fades + rises children into view the first time they enter the viewport.
 * Renders children statically when the user prefers reduced motion.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 24,
}: ScrollRevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
