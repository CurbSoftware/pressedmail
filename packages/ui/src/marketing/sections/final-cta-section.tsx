import Link from 'next/link';

import { cn } from '#utils';
import { ArrowRight } from 'lucide-react';

import { UMAMI_EVENTS, umamiClick } from '@kit/shared/analytics';

import { Button } from '../../shadcn/button';
import type { CtaTarget, ServerSectionProps } from './types';

export interface FinalCtaSectionProps extends ServerSectionProps {
  /**
   * @deprecated Supplied by not-yet-migrated targets. Paid products pass
   * `primaryCta` instead. Removed once PRs 7/8 migrate both target consumers.
   */
  freePluginUrl?: string;
  /** Paid primary CTA (e.g. checkout). Overrides the legacy freePluginUrl. */
  primaryCta?: CtaTarget;
  /** Paid secondary CTA (defaults to /pricing). */
  secondaryCta?: CtaTarget;
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

export function FinalCtaSection({
  t,
  freePluginUrl,
  primaryCta,
  secondaryCta,
  className,
}: FinalCtaSectionProps) {
  const primaryHref = primaryCta?.href ?? freePluginUrl ?? '/pricing';
  const primaryLabel = primaryCta?.label ?? t('marketing:finalCta.ctaInstall');
  const primaryExternal = primaryCta?.external ?? isExternalHref(primaryHref);
  const secondaryHref = secondaryCta?.href ?? '/pricing';
  const secondaryLabel =
    secondaryCta?.label ?? t('marketing:finalCta.ctaFeatures');
  const secondaryExternal =
    secondaryCta?.external ?? isExternalHref(secondaryHref);

  return (
    <section
      className={cn(
        'section-spacing-lg relative overflow-hidden border-t border-[color:var(--surface-border)] bg-[var(--surface-section-alt)] bg-[image:var(--surface-cta-chrome)]',
        className,
      )}
    >
      {/* Subtle background effect */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-[var(--glow-primary-medium)] blur-[100px]" />
      </div>

      <div className="relative container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-foreground mb-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {t('marketing:finalCta.heading')}
          </h2>

          <p className="text-muted-foreground mb-8 text-base sm:text-lg">
            {t('marketing:finalCta.description')}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)]"
            >
              <Link
                href={primaryHref}
                className="group"
                {...(primaryExternal
                  ? {
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    }
                  : {})}
                {...umamiClick(UMAMI_EVENTS.ctaClicked, {
                  'cta-id': 'final-cta-install',
                  'cta-location': 'final-cta',
                  'cta-target': primaryHref,
                })}
              >
                {primaryLabel}
                <ArrowRight
                  className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="btn-shimmer">
              <Link
                href={secondaryHref}
                {...(secondaryExternal
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                {...umamiClick(UMAMI_EVENTS.ctaClicked, {
                  'cta-id': 'final-cta-pricing',
                  'cta-location': 'final-cta',
                  'cta-target': secondaryHref,
                })}
              >
                {secondaryLabel}
              </Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-6 text-sm">
            {t('marketing:finalCta.footer')}
          </p>
        </div>
      </div>
    </section>
  );
}
