import Link from 'next/link';

import { cn } from '#utils';
import { ArrowRight } from 'lucide-react';

import { UMAMI_EVENTS, umamiClick } from '@kit/shared/analytics';

import { Trans } from '../../makerkit/trans';
import { Button } from '../../shadcn/button';
import type { CtaTarget, ServerSectionProps } from './types';

export interface SiteCtaSectionProps extends ServerSectionProps {
  /**
   * @deprecated Legacy secondary CTA for not-yet-migrated targets. Paid
   * products pass `secondaryCta` (or omit it). Removed after PRs 7/8.
   */
  freePluginUrl?: string;
  accentGlowStyle?: React.CSSProperties;
  /** Paid primary CTA (defaults to /pricing). */
  primaryCta?: CtaTarget;
  /** Paid secondary CTA. When absent and no freePluginUrl, the secondary button is omitted. */
  secondaryCta?: CtaTarget;
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

export function SiteCtaSection({
  t,
  freePluginUrl,
  primaryCta,
  secondaryCta,
  accentGlowStyle,
  className,
}: SiteCtaSectionProps) {
  const primaryHref = primaryCta?.href ?? '/pricing';
  const primaryLabel = primaryCta?.label ?? t('marketing:siteCta.getPro');
  const primaryExternal = primaryCta?.external ?? isExternalHref(primaryHref);

  // Secondary CTA: explicit paid secondary, else legacy freePluginUrl, else none.
  const secondaryHref = secondaryCta?.href ?? freePluginUrl;
  const secondaryLabel =
    secondaryCta?.label ??
    (freePluginUrl ? t('marketing:siteCta.installFreePlugin') : null);
  const secondaryExternal =
    secondaryCta?.external ??
    (secondaryHref ? isExternalHref(secondaryHref) : false);

  return (
    <section
      className={cn(
        'site-cta relative isolate overflow-hidden border-t border-[color:var(--surface-border)] bg-[var(--surface-section-alt)] bg-[image:var(--surface-cta-chrome)] py-24 md:py-32 lg:py-40',
        className,
      )}
    >
      {/* Primary glow blob (centered, brand primary) */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-125 w-175 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--glow-primary-medium)] blur-[120px]" />

      {/* Accent glow blob (offset brand purple) */}
      <div
        className="pointer-events-none absolute top-1/4 right-1/4 -z-10 h-80 w-80 rounded-full blur-[100px]"
        style={accentGlowStyle ?? { background: 'var(--glow-primary-soft)' }}
      />

      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-primary mb-4 text-sm font-semibold tracking-wider uppercase">
            {t('marketing:siteCta.kicker')}
          </p>

          <h2 className="font-heading text-foreground mb-6 text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <Trans
              i18nKey="marketing:siteCta.headline"
              components={{
                highlight: (
                  <span className="from-primary to-primary/70 bg-linear-to-r bg-clip-text text-transparent" />
                ),
              }}
            />
          </h2>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="btn-shimmer h-12 px-8 text-base font-semibold"
            >
              <Link
                href={primaryHref}
                {...(primaryExternal
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                {...umamiClick(UMAMI_EVENTS.ctaClicked, {
                  'cta-id': 'site-cta-pro',
                  'cta-location': 'site-cta',
                  'cta-target': primaryHref,
                })}
              >
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>

            {secondaryHref && secondaryLabel ? (
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="group border-border/30 hover:bg-primary/50 h-12 border px-8 text-base"
              >
                <Link
                  href={secondaryHref}
                  {...(secondaryExternal
                    ? {
                        target: '_blank',
                        rel: 'noopener noreferrer',
                      }
                    : {})}
                  {...umamiClick(UMAMI_EVENTS.ctaClicked, {
                    'cta-id': 'site-cta-install',
                    'cta-location': 'site-cta',
                    'cta-target': secondaryHref,
                  })}
                >
                  {secondaryLabel}
                  <ArrowRight
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
            ) : null}
          </div>

          <p className="text-muted-foreground/60 mt-8 text-sm">
            {t('marketing:siteCta.noCreditCard')}
          </p>
        </div>
      </div>
    </section>
  );
}
