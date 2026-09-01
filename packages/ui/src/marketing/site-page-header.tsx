import type { ReactNode } from 'react';

import { cn } from '#utils';

import { MarketingHeroShaderBackground } from './marketing-hero-shader-background';

export function SitePageHeader({
  eyebrow,
  title,
  subtitle,
  container = true,
  showShader = true,
  className = '',
  titleClassName = '',
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: string;
  container?: boolean;
  showShader?: boolean;
  className?: string;
  titleClassName?: string;
}) {
  const containerClass = container ? 'container' : '';
  const titleClasses =
    titleClassName ||
    'font-heading text-3xl tracking-tighter xl:text-5xl dark:text-white';

  return (
    <div
      className={cn(
        'border-border/40 relative isolate overflow-hidden border-b py-6 xl:py-8 2xl:py-10',
        className,
      )}
    >
      {showShader ? <MarketingHeroShaderBackground variant="header" /> : null}

      <div
        className={cn(
          'relative z-10 flex flex-col items-center gap-y-2 lg:gap-y-3',
          containerClass,
        )}
      >
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}

        <h1 className={titleClasses}>{title}</h1>

        {subtitle ? (
          <h2
            className={
              'text-muted-foreground text-lg tracking-tight 2xl:text-2xl'
            }
          >
            {subtitle}
          </h2>
        ) : null}
      </div>
    </div>
  );
}
