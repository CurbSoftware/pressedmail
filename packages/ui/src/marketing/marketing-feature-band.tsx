import type { ComponentType, HTMLAttributes, ReactNode, SVGProps } from 'react';

import { cn } from '#utils';
import { ArrowRight } from 'lucide-react';

import { Badge } from '../shadcn/badge';
import { Card, CardContent } from '../shadcn/card';
import { Separator } from '../shadcn/separator';

type MarketingFeatureIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface MarketingFeatureRowProps extends Omit<
  HTMLAttributes<HTMLAnchorElement>,
  'title'
> {
  title: ReactNode;
  description: ReactNode;
  href: string;
  icon?: MarketingFeatureIcon;
  chips?: ReactNode[];
  ctaLabel?: ReactNode;
}

interface MarketingFeatureBandProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'title'
> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  rows?: MarketingFeatureRowProps[];
  visual?: ReactNode;
  action?: {
    href: string;
    label: ReactNode;
  };
  reversed?: boolean;
}

export function MarketingFeatureRow({
  title,
  description,
  href,
  icon: Icon,
  chips = [],
  ctaLabel = 'Explore',
  className,
  ...props
}: MarketingFeatureRowProps) {
  return (
    <a
      {...props}
      href={href}
      className={cn(
        'group hover:bg-muted/50 focus-visible:ring-ring flex items-start gap-4 rounded-lg p-3 transition-all focus-visible:ring-2 focus-visible:outline-none motion-safe:hover:-translate-y-0.5',
        className,
      )}
    >
      {Icon ? (
        <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-semibold">
          {title}
        </span>
        <span className="text-muted-foreground mt-1 line-clamp-2 block text-xs leading-relaxed">
          {description}
        </span>
        {chips.length ? (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((chip, index) => (
              <Badge
                // Feature chip text is often repeated across rows, so keep the
                // source-order index in the key.
                key={index}
                variant="secondary"
                className="text-[0.65rem]"
              >
                {chip}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>

      <span className="text-muted-foreground group-hover:text-primary mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium transition-colors">
        <span className="sr-only">{ctaLabel}</span>
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </span>
    </a>
  );
}

export function MarketingFeatureBand({
  eyebrow,
  title,
  description,
  rows = [],
  visual,
  action,
  reversed,
  className,
  children,
  ...props
}: MarketingFeatureBandProps) {
  return (
    <section
      {...props}
      className={cn(
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
        className,
      )}
    >
      <Card className="relative overflow-hidden rounded-lg border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-chrome)] py-0 shadow-[var(--shadow-elevated)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[var(--glow-primary-soft)] opacity-70"
        />
        <CardContent
          className={cn(
            'relative grid gap-0 p-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)]',
            reversed && 'lg:grid-cols-[minmax(420px,1fr)_minmax(0,0.92fr)]',
          )}
        >
          <div
            className={cn(
              'border-border/70 relative min-h-[360px] overflow-hidden border-b p-6 md:p-8 lg:border-r lg:border-b-0',
              reversed && 'lg:order-2 lg:border-r-0 lg:border-l',
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(520px_circle_at_30%_20%,white,transparent)] bg-[size:34px_34px] opacity-[0.18]"
            />
            <div className="relative z-10">
              {eyebrow ? (
                <Badge variant="secondary" className="mb-4">
                  {eyebrow}
                </Badge>
              ) : null}
              <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance md:text-3xl">
                {title}
              </h2>
              {description ? (
                <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed md:text-base">
                  {description}
                </p>
              ) : null}
              {action ? (
                <a
                  href={action.href}
                  className="text-primary focus-visible:ring-ring mt-5 inline-flex items-center gap-2 rounded-md text-sm font-medium underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
            {visual ? <div className="relative z-10 mt-8">{visual}</div> : null}
          </div>

          <div className={cn('p-4 md:p-5', reversed && 'lg:order-1')}>
            <div className="space-y-2">
              {rows.length
                ? rows.map((row, index) => (
                    <div key={`${row.href}-${index}`}>
                      <MarketingFeatureRow {...row} />
                      {index < rows.length - 1 ? (
                        <Separator className="my-2" />
                      ) : null}
                    </div>
                  ))
                : children}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
