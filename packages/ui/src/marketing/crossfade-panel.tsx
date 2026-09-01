'use client';

import type { ReactNode } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { cn } from '#utils';

interface CrossfadePanelProps {
  /** Changing this key triggers the crossfade to the new children. */
  panelKey: string;
  children: ReactNode;
  className?: string;
}

/**
 * Crossfades between panels keyed by `panelKey` (e.g. the active tab id).
 * Renders children directly when the user prefers reduced motion.
 */
export function CrossfadePanel({
  panelKey,
  children,
  className,
}: CrossfadePanelProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={panelKey}
        className={cn(className)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
