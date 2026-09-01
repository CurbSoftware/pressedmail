'use client';

import { useEffect, useState } from 'react';

import { cn } from '#utils';
import { CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { UMAMI_EVENTS, umamiClick } from '@kit/shared/analytics';

import { Button } from '../../shadcn/button';
import { MarketingHeroShaderBackground } from '../marketing-hero-shader-background';
import { PricingCards, type PricingPlan } from './pricing-cards';

export interface PricingSectionFreeCallout {
  title: string;
  subtitle: string;
  items: string[];
  cta: string;
}

export interface PricingSectionProps {
  yearlyPlans: PricingPlan[];
  lifetimePlans: PricingPlan[];
  cryptoPlans?: PricingPlan[];
  freePluginUrl?: string;
  freeCallout?: PricingSectionFreeCallout;
  notes?: string[];
  notesVariant?: 'list' | 'paragraph';
  showTable?: boolean;
  simpleHeading?: boolean;
  heroShader?: boolean;
  comparisonGrid?: React.ReactNode;
  className?: string;
  headline?: React.ReactNode;
  description?: React.ReactNode;
  toggleCaption?: React.ReactNode;
  belowCardsHint?: React.ReactNode;
  cryptoBanner?: React.ReactNode;
  initialFrequency?: PricingFrequency;
  showFreeCallout?: boolean;
  onCheckoutPlan?: (plan: PricingPlan) => void;
}

export type PricingFrequency = 'yearly' | 'lifetime' | 'crypto';

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function PricingFrequencyToggle({
  frequency,
  onFrequencyChange,
  options,
}: {
  frequency: PricingFrequency;
  onFrequencyChange: (f: PricingFrequency) => void;
  options: PricingFrequency[];
}) {
  const t = useTranslations('marketing');

  return (
    <div className="relative mx-auto flex w-fit rounded-full border border-[color:var(--surface-card-border)] bg-[var(--surface-elevated)] p-1 shadow-[var(--shadow-card)] backdrop-blur-sm">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onFrequencyChange(option)}
          {...umamiClick(UMAMI_EVENTS.pricingIntervalToggled, {
            interval: option,
          })}
          aria-pressed={frequency === option}
          className={cn(
            'min-h-11 rounded-full px-5 py-1.5 text-sm font-medium transition-colors',
            frequency === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>
            {option === 'yearly'
              ? t('pricingSection.yearly')
              : option === 'lifetime'
                ? t('pricingSection.lifetime')
                : t('pricingSection.crypto')}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PricingSection({
  yearlyPlans,
  lifetimePlans,
  cryptoPlans,
  freePluginUrl = '',
  freeCallout,
  notes = [],
  notesVariant = 'list',
  showTable = true,
  simpleHeading = false,
  heroShader = false,
  comparisonGrid,
  className,
  headline,
  description,
  toggleCaption,
  belowCardsHint,
  cryptoBanner,
  initialFrequency = 'yearly',
  showFreeCallout = true,
  onCheckoutPlan,
}: PricingSectionProps) {
  const t = useTranslations('marketing');
  const freePluginExternal = isExternalHref(freePluginUrl);
  const freeCalloutItems = freeCallout?.items.filter(
    (item) => item.trim().length > 0,
  );

  const hasCrypto = !!cryptoPlans && cryptoPlans.length > 0;
  const frequencyOptions: PricingFrequency[] = hasCrypto
    ? ['yearly', 'lifetime', 'crypto']
    : ['yearly', 'lifetime'];
  const initialSupportedFrequency = frequencyOptions.includes(initialFrequency)
    ? initialFrequency
    : 'yearly';
  const [frequency, setFrequency] = useState<PricingFrequency>(
    initialSupportedFrequency,
  );

  useEffect(() => {
    setFrequency(initialSupportedFrequency);
  }, [initialSupportedFrequency]);

  const displayPlans =
    frequency === 'crypto'
      ? (cryptoPlans ?? lifetimePlans)
      : frequency === 'yearly'
        ? yearlyPlans
        : lifetimePlans;

  return (
    <>
      {/* Section 1: Hero (shader/grid bg, heading, toggle, cards, free strip) */}
      <section
        className={cn(
          'relative overflow-hidden py-16 md:py-24',
          heroShader ? 'border-border/40 isolate' : 'section-bg-grid',
          className,
        )}
        id="pricing"
      >
        {heroShader ? (
          <MarketingHeroShaderBackground />
        ) : (
          <div className="pointer-events-none absolute inset-0">
            <div className="bg-primary/5 absolute top-0 left-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full blur-[150px]" />
            <div className="bg-primary/3 absolute right-1/3 bottom-0 h-[300px] w-[300px] translate-x-1/2 rounded-full blur-[120px]" />
          </div>
        )}

        <div className="relative z-10 container">
          <div className="mx-auto max-w-6xl">
            {/* Header */}
            <div className="mb-12 space-y-4 text-center lg:mb-16">
              {simpleHeading ? (
                <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  {headline ?? t('pricingSection.headline')}
                </h2>
              ) : (
                <h1 className="font-heading text-foreground text-3xl leading-[1.1] font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  {headline ?? t('pricingSection.headline')}
                </h1>
              )}
              <p className="text-muted-foreground mx-auto max-w-xl text-base">
                {description ?? t('pricingSection.description')}
              </p>

              {/* Frequency toggle */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <PricingFrequencyToggle
                  frequency={frequency}
                  onFrequencyChange={setFrequency}
                  options={frequencyOptions}
                />
                {toggleCaption ? (
                  <p
                    className="text-muted-foreground text-xs"
                    data-testid="pricing-toggle-caption"
                  >
                    {toggleCaption}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Pricing Cards */}
            <PricingCards
              plans={displayPlans}
              onCheckoutPlan={onCheckoutPlan}
            />

            {frequency === 'crypto' && cryptoBanner}

            {notes.length > 0 &&
              (notesVariant === 'paragraph' ? (
                <p className="text-muted-foreground mx-auto mt-5 max-w-4xl text-center text-xs">
                  {notes.join(' ')}
                </p>
              ) : (
                <ul className="text-muted-foreground mx-auto mt-5 flex max-w-4xl list-disc flex-col gap-1.5 pl-5 text-sm sm:list-inside sm:pl-0 sm:text-center">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ))}

            {belowCardsHint ? (
              <div className="mx-auto mt-5 max-w-4xl text-center text-sm">
                {belowCardsHint}
              </div>
            ) : null}

            {/* Free Download Strip */}
            {showFreeCallout ? (
              freeCallout ? (
                <div className="border-primary/20 bg-primary/10 mx-auto mt-8 max-w-4xl rounded-xl border px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-3">
                      <div className="text-center lg:text-left">
                        <p className="text-foreground text-sm font-semibold">
                          {freeCallout.title}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {freeCallout.subtitle}
                        </p>
                      </div>

                      <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {freeCalloutItems?.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle
                              className="text-primary mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="text-foreground/90 leading-snug">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button asChild size="default" className="shrink-0">
                      <a
                        href={freePluginUrl}
                        data-test="pricing-install-free"
                        {...(freePluginExternal
                          ? {
                              target: '_blank',
                              rel: 'noopener noreferrer',
                            }
                          : {})}
                      >
                        {freeCallout.cta}
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-primary/20 bg-primary/25 hover:bg-primary/40 mx-auto mt-8 flex max-w-4xl flex-col items-center justify-between gap-3 rounded-xl border px-5 py-4 transition-colors sm:flex-row">
                  <div className="text-center sm:text-left">
                    <p className="text-foreground text-sm font-medium">
                      {t('pricingSection.freeStrip')}
                    </p>
                  </div>
                  <Button asChild size="default" className="shrink-0">
                    <a
                      href={freePluginUrl}
                      data-test="pricing-install-free"
                      {...(freePluginExternal
                        ? {
                            target: '_blank',
                            rel: 'noopener noreferrer',
                          }
                        : {})}
                    >
                      {t('pricingSection.installFree')}
                    </a>
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </section>

      {/* Section 2: Comparison grid */}
      {showTable && comparisonGrid && (
        <section className="bg-background py-16 md:py-24">
          <div className="container">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 lg:text-left">
                <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  {t('pricingSection.compareAll')}
                </h2>
                <p className="text-muted-foreground mt-3 text-base">
                  {t('pricingSection.seeIncluded')}
                </p>
              </div>

              {comparisonGrid}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
