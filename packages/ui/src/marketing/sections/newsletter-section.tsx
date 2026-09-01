import type { ReactNode } from 'react';

import { cn } from '#utils';
import { Bell } from 'lucide-react';

import { BorderTrail } from '../border-trail';
import type { ServerSectionProps } from './types';

export interface NewsletterSectionProps extends ServerSectionProps {
  form: ReactNode;
}

export function NewsletterSection({
  t,
  className,
  form,
}: NewsletterSectionProps) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden border-t border-[color:var(--surface-border)] bg-[var(--surface-section-alt)] bg-[image:var(--surface-cta-chrome)] py-20 md:py-28 lg:py-36',
        className,
      )}
      data-analytics-section="newsletter"
    >
      <div className="relative container">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
            {/* Left column: copy */}
            <div>
              <div className="bg-primary/10 text-primary mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                <Bell className="h-6 w-6" aria-hidden="true" />
              </div>

              <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                {t('marketing:siteCta.newsletterSubtext')}
              </h2>

              <p className="text-muted-foreground mt-3 max-w-md text-base leading-relaxed md:text-lg">
                {t('marketing:siteCta.newsletterDesc')}
              </p>
            </div>

            {/* Right column: form card */}
            <div className="relative overflow-hidden rounded-2xl border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-chrome)] p-6 shadow-[var(--shadow-elevated)] backdrop-blur-sm sm:p-8">
              <BorderTrail size={80} duration={10} cornerRadius={16} />

              {/* Subtle radial glow at top of card */}
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-[radial-gradient(ellipse_at_50%_0%,var(--glow-primary-soft)_0%,transparent_70%)] opacity-60" />

              <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">
                {t('marketing:siteCta.newsletterCardHeading')}
              </p>

              <p className="text-muted-foreground mb-5 text-sm">
                {t('marketing:siteCta.newsletterReassurance')}
              </p>

              {form}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
