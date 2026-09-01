'use client';

import { cn } from '#utils';
import { CheckCircle, Globe, MinusCircle, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { UMAMI_EVENTS, umamiClick } from '@kit/shared/analytics';

import { Badge } from '../../shadcn/badge';
import { Button } from '../../shadcn/button';
import { BorderTrail } from '../border-trail';

export interface PricingPlan {
  name: string;
  persona: string;
  price: number;
  originalPrice?: number;
  priceLabel: string;
  priceSubtext: string;
  badge?: string;
  badgeColor?: 'cyan' | 'gold' | 'purple';
  textColor?: string;
  highlighted?: boolean;
  buttonText: string;
  buttonVariant: 'ghost' | 'cyan' | 'gold' | 'purple';
  outcomes: string[];
  capabilities: string[];
  notIncluded: string[];
  microCopy?: string;
  promoTag?: string;
  planId: string;
  productSlug: string;
  isLifetime?: boolean;
  sitesAllowed: number;
  guaranteeDays: number;
  showGuarantee?: boolean;
  checkoutUrl: string;
  disabled?: boolean;
  checkoutMode?: 'link' | 'bitcart';
  cryptoPlanSlug?: string;
}

export interface PricingCardsProps {
  plans: PricingPlan[];
  className?: string;
  onCheckoutPlan?: (plan: PricingPlan) => void;
}

function getExternalLinkProps(href: string) {
  return /^https?:\/\//i.test(href)
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
}

function IncludedItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <CheckCircle
        className="text-primary mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <span className="text-foreground/90 leading-snug">{text}</span>
    </li>
  );
}

function NotIncludedItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <MinusCircle
        className="text-muted-foreground/40 mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <span className="text-muted-foreground/60 leading-snug">{text}</span>
    </li>
  );
}

function PricingCard({
  plan,
  onCheckoutPlan,
}: {
  plan: PricingPlan;
  onCheckoutPlan?: (plan: PricingPlan) => void;
}) {
  const t = useTranslations('marketing');
  const isAccented = plan.highlighted || !!plan.badgeColor;
  const hasCustomCheckout = !!onCheckoutPlan && plan.checkoutMode === 'bitcart';

  // The single most valuable event on the site: which plan a visitor picked,
  // and by which route. Declarative rather than a click handler, so the hosted
  // checkout link keeps working with JavaScript still loading.
  const checkoutAnalytics = umamiClick(UMAMI_EVENTS.pricingSelected, {
    'plan-id': plan.planId,
    'plan-name': plan.name,
    'plan-price': plan.price,
    'product-slug': plan.productSlug,
    'checkout-mode': hasCustomCheckout ? 'bitcart' : 'link',
    interval: plan.isLifetime ? 'lifetime' : 'recurring',
  });
  const buttonClassName = cn(
    'min-h-11 w-full font-semibold transition-all',
    plan.buttonVariant === 'ghost' &&
      'border-border bg-muted/50 text-foreground hover:border-primary/40 hover:bg-muted',
    (plan.buttonVariant === 'cyan' ||
      plan.buttonVariant === 'gold' ||
      plan.buttonVariant === 'purple') &&
      'bg-primary text-primary-foreground hover:bg-primary/90',
  );

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)] transition-all duration-300 sm:p-7',
        isAccented
          ? 'bg-[image:var(--card-highlight-chrome)] backdrop-blur-sm'
          : 'bg-[image:var(--card-chrome)] backdrop-blur-sm',
        isAccented
          ? 'border-primary/40 shadow-[var(--shadow-elevated)]'
          : 'border-[color:var(--surface-card-border)]',
        isAccented
          ? 'hover:border-primary/60'
          : 'hover:border-primary/50 hover:shadow-[var(--shadow-elevated)]',
      )}
    >
      {/* Border trail on featured cards */}
      {isAccented && <BorderTrail size={80} duration={10} />}

      {/* Badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            className={cn(
              'px-3 py-0.5 text-xs font-semibold shadow-md',
              plan.badge === 'Limited Time'
                ? 'border-primary/50 bg-background text-foreground'
                : 'border-primary/50 bg-primary text-primary-foreground',
            )}
          >
            {plan.badge}
          </Badge>
        </div>
      )}

      {/* Header: Name + Persona */}
      <div className="mb-5">
        <h3 className="text-foreground text-lg font-bold">{plan.name}</h3>
        {plan.persona && (
          <p className="text-muted-foreground mt-1 text-sm">{plan.persona}</p>
        )}
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-1.5">
          {plan.originalPrice !== undefined && (
            <span className="text-muted-foreground/60 text-lg line-through">
              ${plan.originalPrice}
            </span>
          )}
          <span className="text-foreground text-4xl font-bold tracking-tight">
            ${plan.price}
          </span>
          {plan.priceLabel && (
            <span className="text-muted-foreground text-sm">
              {plan.priceLabel}
            </span>
          )}
        </div>
        {plan.priceSubtext && (
          <p className="text-muted-foreground/80 mt-1 text-xs">
            {plan.priceSubtext}
          </p>
        )}
        {plan.promoTag && (
          <div className="mt-2 flex justify-center">
            <span className="border-primary text-background from-foreground to-foreground/70 inline-block rounded-full border bg-gradient-to-r px-4 py-1 text-xs font-bold tracking-wide uppercase shadow-md">
              {plan.promoTag}
            </span>
          </div>
        )}
      </div>

      {/* Websites spec row */}
      <div className="border-border/40 mb-5 flex items-center gap-2 border-t pt-4">
        <Globe className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="text-foreground text-sm">
          <span className="font-bold">{plan.sitesAllowed}</span>{' '}
          {plan.sitesAllowed === 1 ? 'Website' : 'Websites'}
        </span>
      </div>

      {/* Separator */}
      <div className="border-border/40 mb-5 border-t" />

      {/* Included features */}
      <div className="mb-6 flex-1">
        <ul className="space-y-2.5">
          {plan.outcomes.map((outcome) => (
            <IncludedItem key={outcome} text={outcome} />
          ))}
        </ul>

        {/* Not included features */}
        {plan.notIncluded.length > 0 && (
          <>
            <div className="border-border/20 my-3 border-t" />
            <ul className="space-y-2">
              {plan.notIncluded.map((item) => (
                <NotIncludedItem key={item} text={item} />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* CTA Section */}
      <div className="mt-auto space-y-2">
        {plan.disabled ? (
          <Button
            type="button"
            size="lg"
            className={buttonClassName}
            variant={plan.buttonVariant === 'ghost' ? 'outline' : 'default'}
            disabled
          >
            {plan.buttonText}
          </Button>
        ) : hasCustomCheckout ? (
          <Button
            type="button"
            size="lg"
            className={buttonClassName}
            variant={plan.buttonVariant === 'ghost' ? 'outline' : 'default'}
            onClick={() => onCheckoutPlan?.(plan)}
            {...checkoutAnalytics}
          >
            {plan.buttonText}
          </Button>
        ) : (
          <Button
            asChild
            size="lg"
            className={buttonClassName}
            variant={plan.buttonVariant === 'ghost' ? 'outline' : 'default'}
          >
            <a
              href={plan.checkoutUrl}
              {...getExternalLinkProps(plan.checkoutUrl)}
              {...checkoutAnalytics}
            >
              {plan.buttonText}
            </a>
          </Button>
        )}
        {plan.showGuarantee !== false && (
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <ShieldCheck
              className="text-primary h-3.5 w-3.5"
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              {t('pricingSection.guarantee', {
                days: String(plan.guaranteeDays),
              })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PricingCards({
  plans,
  className,
  onCheckoutPlan,
}: PricingCardsProps) {
  if (plans.length === 0) return null;

  // Single card (lifetime view) → centered, wider
  if (plans.length === 1) {
    return (
      <div className={cn('mx-auto max-w-md', className)}>
        <PricingCard plan={plans[0]!} onCheckoutPlan={onCheckoutPlan} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative mx-auto grid max-w-6xl gap-5',
        plans.length <= 3
          ? 'sm:grid-cols-2 xl:grid-cols-3'
          : 'sm:grid-cols-2 xl:grid-cols-4',
        className,
      )}
    >
      {plans.map((plan) => (
        <PricingCard
          key={plan.planId}
          plan={plan}
          onCheckoutPlan={onCheckoutPlan}
        />
      ))}
    </div>
  );
}
