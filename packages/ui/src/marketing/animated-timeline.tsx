'use client';

import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '#utils';

export interface AnimatedTimelineItem {
  /** Optional short title above the body. */
  title?: ReactNode;
  body: ReactNode;
}

interface AnimatedTimelineProps {
  items: AnimatedTimelineItem[];
  className?: string;
}

/**
 * Numbered vertical timeline whose connector line draws in and whose steps
 * fade in as they scroll into view. Static under reduced motion.
 */
export function AnimatedTimeline({ items, className }: AnimatedTimelineProps) {
  const reducedMotion = useReducedMotion();

  return (
    <ol data-testid="animated-timeline" className={cn('relative', className)}>
      <motion.span
        aria-hidden="true"
        className="bg-border/70 absolute top-2 bottom-2 left-[19px] w-px origin-top"
        initial={reducedMotion ? false : { scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />

      {items.map((item, index) => (
        <motion.li
          key={index}
          className="relative flex gap-4 pb-8 last:pb-0"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, delay: index * 0.08 }}
        >
          <span className="border-border/70 bg-background text-primary z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">
            {index + 1}
          </span>
          <div className="pt-2">
            {item.title ? (
              <h3 className="text-foreground text-sm font-semibold">
                {item.title}
              </h3>
            ) : null}
            <div className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {item.body}
            </div>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
