import type { ReactNode } from 'react';

import { cn } from '#utils';

interface MarketingSectionHeadingProps {
  eyebrow?: ReactNode;
  heading: ReactNode;
  paragraph?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

export function MarketingSectionHeading({
  eyebrow,
  heading,
  paragraph,
  align = 'left',
  className,
}: MarketingSectionHeadingProps) {
  const isCenter = align === 'center';

  return (
    <div
      data-testid="marketing-section-heading"
      className={cn(
        'flex flex-col gap-4',
        isCenter ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? (
        <h2
          data-testid="marketing-section-heading-eyebrow"
          className="text-primary font-mono text-sm font-semibold tracking-[0.12em] uppercase"
        >
          {eyebrow}
        </h2>
      ) : null}

      <h3
        data-testid="marketing-section-heading-heading"
        className="font-heading text-foreground text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl"
      >
        {heading}
      </h3>

      {paragraph ? (
        <p
          data-testid="marketing-section-heading-paragraph"
          className={cn(
            'text-muted-foreground max-w-[640px] text-base leading-relaxed sm:text-lg',
            isCenter && 'mx-auto',
          )}
        >
          {paragraph}
        </p>
      ) : null}
    </div>
  );
}
