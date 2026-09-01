import Link from 'next/link';

import { cn } from '#utils';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Database,
  DollarSign,
  ExternalLink,
  LayoutDashboard,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';

import { Button } from '../../shadcn/button';
import type { ServerSectionProps } from './types';

export interface ComparisonRow {
  feature: string;
  description: string;
  icon: LucideIcon;
  pressedmail: string;
  helpdesk: string;
  webmail: string;
}

export interface ComparisonSectionProps extends ServerSectionProps {
  productName: string;
  rows: ComparisonRow[];
  subtitle?: string;
  recommendedFor?: {
    product: string;
    helpdesk: string;
    webmail: string;
  };
  verdict?: {
    product: string;
    helpdesk: string;
    webmail: string;
  };
  ctaLinks?: {
    primary?: { label: string; href: string };
    secondary?: { label: string; href: string };
  };
}

function getDefaultComparisonData(t: (key: string) => string): ComparisonRow[] {
  return [
    {
      feature: t('marketing:comparison.rowPrivacy'),
      description: 'Keep full control of your mail',
      icon: Lock,
      pressedmail: t('marketing:comparison.rowPrivacyPM'),
      helpdesk: t('marketing:comparison.rowPrivacyHD'),
      webmail: t('marketing:comparison.rowPrivacyWM'),
    },
    {
      feature: t('marketing:comparison.rowCost'),
      description: 'Predictable one-time pricing',
      icon: DollarSign,
      pressedmail: t('marketing:comparison.rowCostPM'),
      helpdesk: t('marketing:comparison.rowCostHD'),
      webmail: t('marketing:comparison.rowCostWM'),
    },
    {
      feature: t('marketing:comparison.rowSetup'),
      description: 'No context switching',
      icon: LayoutDashboard,
      pressedmail: t('marketing:comparison.rowSetupPM'),
      helpdesk: t('marketing:comparison.rowSetupHD'),
      webmail: t('marketing:comparison.rowSetupWM'),
    },
    {
      feature: t('marketing:comparison.rowAI'),
      description: 'Mail stays with provider',
      icon: Database,
      pressedmail: t('marketing:comparison.rowAIPM'),
      helpdesk: t('marketing:comparison.rowAIHD'),
      webmail: t('marketing:comparison.rowAIWM'),
    },
    {
      feature: t('marketing:comparison.rowBranding'),
      description: 'Clean, professional look',
      icon: Sparkles,
      pressedmail: t('marketing:comparison.rowBrandingPM'),
      helpdesk: t('marketing:comparison.rowBrandingHD'),
      webmail: t('marketing:comparison.rowBrandingWM'),
    },
    {
      feature: t('marketing:comparison.rowBestFor'),
      description: 'White-label branding',
      icon: Users,
      pressedmail: t('marketing:comparison.rowBestForPM'),
      helpdesk: t('marketing:comparison.rowBestForHD'),
      webmail: t('marketing:comparison.rowBestForWM'),
    },
  ];
}

export function ComparisonSection({
  t,
  productName,
  rows,
  subtitle,
  recommendedFor,
  verdict,
  ctaLinks,
  className,
}: ComparisonSectionProps) {
  const comparisonData = rows.length > 0 ? rows : getDefaultComparisonData(t);

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-[var(--surface-section)] py-16 md:py-24 lg:py-32',
        className,
      )}
    >
      {/* Subtle Grid Pattern Background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                             linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[var(--glow-primary-soft)] blur-[150px]" />
      </div>

      <div className="relative container">
        {/* Section Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="font-heading text-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('marketing:comparison.heading')}
          </h2>
          {subtitle && (
            <p className="text-muted-foreground text-lg">{subtitle}</p>
          )}
        </div>

        {/* Mobile Comparison Cards */}
        <div className="mx-auto max-w-md space-y-4 md:hidden">
          {comparisonData.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.feature}
                className="overflow-hidden rounded-xl border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]"
              >
                <div className="bg-muted/30 flex items-center gap-3 p-3">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <Icon
                      className="text-muted-foreground h-4 w-4"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <div className="text-foreground text-sm font-medium">
                      {row.feature}
                    </div>
                    <div className="text-muted-foreground/60 text-xs">
                      {row.description}
                    </div>
                  </div>
                </div>

                <div className="divide-border grid grid-cols-3 divide-x">
                  <div className="bg-destructive/5 flex flex-col items-center justify-center gap-1 p-3 text-center">
                    <span className="text-destructive/70 text-[9px] font-semibold tracking-wide uppercase">
                      Helpdesk
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {row.helpdesk}
                    </span>
                  </div>

                  <div className="bg-primary/5 relative flex flex-col items-center justify-center gap-1 overflow-hidden p-3 text-center">
                    <div className="bg-primary/5 pointer-events-none absolute inset-0 blur-xl" />
                    <span className="text-primary text-[9px] font-semibold tracking-wide uppercase">
                      {productName}
                    </span>
                    <span className="text-primary relative text-xs font-medium">
                      {row.pressedmail}
                    </span>
                  </div>

                  <div className="bg-muted/30 flex flex-col items-center justify-center gap-1 p-3 text-center">
                    <span className="text-muted-foreground/70 text-[9px] font-semibold tracking-wide uppercase">
                      Webmail
                    </span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {row.webmail}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cheat Sheet Table - Desktop */}
        <div className="relative mx-auto hidden max-w-5xl md:block">
          <div className="absolute -inset-4 rounded-3xl bg-[var(--glow-primary-soft)] blur-2xl" />

          <div className="border-primary/20 relative overflow-hidden rounded-2xl border bg-[var(--surface-card)] bg-[image:var(--card-chrome)] shadow-[var(--shadow-card)]">
            <div
              className="overflow-x-auto rounded-xl"
              role="region"
              aria-label="Scrollable comparison table"
              tabIndex={0}
            >
              <table
                className="w-full"
                aria-label={`Feature comparison between ${productName}, Helpdesk SaaS, and Classic Webmail`}
              >
                <thead>
                  <tr className="border-b border-[color:var(--surface-card-border)] bg-[var(--surface-elevated)]">
                    <th
                      scope="col"
                      className="text-muted-foreground sticky left-0 z-10 bg-[var(--surface-elevated)] p-4 text-left font-semibold shadow-[var(--shadow-card)] lg:p-5"
                    >
                      {t('marketing:comparison.colFeature')}
                    </th>
                    <th scope="col" className="p-4 text-center lg:p-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text font-semibold text-transparent">
                          {t('marketing:comparison.colPressedMail')}
                        </span>
                      </div>
                    </th>
                    <th scope="col" className="p-4 text-center lg:p-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-muted-foreground">
                          {t('marketing:comparison.colHelpdesk')}
                        </span>
                      </div>
                    </th>
                    <th scope="col" className="p-4 text-center lg:p-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-muted-foreground">
                          {t('marketing:comparison.colWebmail')}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {/* Recommended For Row */}
                  {recommendedFor && (
                    <tr className="bg-[var(--surface-section-alt)]">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-[var(--surface-section-alt)] p-4 text-left shadow-[var(--shadow-card)] lg:p-5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-muted/50 rounded-lg p-2">
                            <Users
                              className="text-muted-foreground h-5 w-5"
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <div className="text-foreground font-medium">
                              {t('marketing:comparison.recommendedFor')}
                            </div>
                            <div className="text-muted-foreground/60 text-sm">
                              Best fit audience
                            </div>
                          </div>
                        </div>
                      </th>
                      <td className="bg-primary/5 p-4 text-center lg:p-5">
                        <span className="text-primary text-sm font-semibold drop-shadow-[0_0_6px_color-mix(in_oklab,var(--primary)_35%,transparent)]">
                          {recommendedFor.product}
                        </span>
                      </td>
                      <td className="p-4 text-center lg:p-5">
                        <span className="text-muted-foreground/70 text-sm">
                          {recommendedFor.helpdesk}
                        </span>
                      </td>
                      <td className="p-4 text-center lg:p-5">
                        <span className="text-muted-foreground/70 text-sm">
                          {recommendedFor.webmail}
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* Feature Rows */}
                  {comparisonData.map((row, index) => {
                    const Icon = row.icon;
                    return (
                      <tr
                        key={row.feature}
                        className={cn(
                          'hover:bg-muted/30 transition-colors',
                          index % 2 === 0 && 'bg-muted/10',
                        )}
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-[var(--surface-card)] p-4 text-left shadow-[var(--shadow-card)] lg:p-5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-muted/50 rounded-lg p-2">
                              <Icon
                                className="text-muted-foreground h-5 w-5"
                                aria-hidden="true"
                              />
                            </div>
                            <div>
                              <div className="text-foreground font-medium">
                                {row.feature}
                              </div>
                              <div className="text-muted-foreground/60 text-sm">
                                {row.description}
                              </div>
                            </div>
                          </div>
                        </th>
                        <td className="bg-primary/5 p-4 text-center lg:p-5">
                          <span className="text-primary text-sm font-semibold drop-shadow-[0_0_6px_color-mix(in_oklab,var(--primary)_35%,transparent)]">
                            {row.pressedmail}
                          </span>
                        </td>
                        <td className="p-4 text-center lg:p-5">
                          <span className="text-muted-foreground/70 text-sm">
                            {row.helpdesk}
                          </span>
                        </td>
                        <td className="p-4 text-center lg:p-5">
                          <span className="text-muted-foreground/70 text-sm">
                            {row.webmail}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Bottom Line Row */}
                  {verdict && (
                    <tr className="border-t border-[color:var(--surface-card-border)] bg-[var(--surface-section-alt)]">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-[var(--surface-section-alt)] p-4 text-left shadow-[var(--shadow-card)] lg:p-5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/20 rounded-lg p-2">
                            <Sparkles
                              className="text-primary h-5 w-5"
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <div className="text-foreground font-semibold">
                              {t('marketing:comparison.bottomLine')}
                            </div>
                            <div className="text-muted-foreground/60 text-sm">
                              {t('marketing:comparison.verdict')}
                            </div>
                          </div>
                        </div>
                      </th>
                      <td className="bg-primary/10 p-4 text-center lg:p-5">
                        <span className="text-primary text-sm font-bold">
                          {verdict.product}
                        </span>
                      </td>
                      <td className="p-4 text-center lg:p-5">
                        <span className="text-muted-foreground text-sm">
                          {verdict.helpdesk}
                        </span>
                      </td>
                      <td className="p-4 text-center lg:p-5">
                        <span className="text-muted-foreground text-sm">
                          {verdict.webmail}
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CTA Row */}
        {ctaLinks && (
          <div className="mx-auto mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {ctaLinks.primary && (
              <Button asChild className="w-full sm:w-auto">
                <Link href={ctaLinks.primary.href}>
                  {ctaLinks.primary.label}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
            {ctaLinks.secondary && (
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href={ctaLinks.secondary.href}>
                  {ctaLinks.secondary.label}
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
