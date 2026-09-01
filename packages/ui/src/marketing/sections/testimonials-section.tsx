import { Quote } from 'lucide-react';

import { cn } from '#utils';

import type { ServerSectionProps } from './types';

export interface Testimonial {
  name: string;
  testimonial: string;
  agency?: string;
}

export interface TestimonialsSectionProps extends ServerSectionProps {
  testimonials: Testimonial[];
}

export function TestimonialsSection({
  t,
  testimonials,
  className,
}: TestimonialsSectionProps) {
  if (testimonials.length === 0) {
    return null;
  }

  // Pick the two strongest testimonials for the 2-card layout
  const featured = testimonials.slice(0, 2);
  const primary = featured[0];
  const secondary = featured[1];

  return (
    <section className={cn('py-16 md:py-24 lg:py-32', className)}>
      <div className="container">
        <div className="mx-auto max-w-6xl">
          {/* Section Header */}
          <div className="mb-10 md:mb-16">
            <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {t('marketing:testimonials.heading')}
            </h2>
          </div>

          {/* 2-Column Bold Cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Card 1: The Light Card */}
            {primary && (
              <div className="relative flex min-h-70 flex-col justify-between rounded-2xl bg-white p-8 md:min-h-85 lg:p-10">
                <Quote
                  className="absolute top-6 right-6 h-8 w-8 text-black/10"
                  aria-hidden="true"
                />

                <p className="mb-8 text-lg leading-relaxed font-medium text-black lg:text-xl">
                  &quot;{primary.testimonial}&quot;
                </p>

                <div className="mt-auto">
                  <p className="font-bold text-black">{primary.name}</p>
                  {primary.agency && (
                    <p className="text-sm text-black/60">{primary.agency}</p>
                  )}
                </div>
              </div>
            )}

            {/* Card 2: The Brand Card (intentionally always primary bg) */}
            {secondary ? (
              <div className="bg-primary relative flex min-h-70 flex-col justify-between rounded-2xl p-8 md:min-h-85 lg:p-10">
                <Quote
                  className="text-primary-foreground/10 absolute top-6 right-6 h-8 w-8"
                  aria-hidden="true"
                />

                <p className="text-primary-foreground mb-8 text-lg leading-relaxed font-medium lg:text-xl">
                  &quot;{secondary.testimonial}&quot;
                </p>

                <div className="mt-auto">
                  <p className="text-primary-foreground font-bold">
                    {secondary.name}
                  </p>
                  {secondary.agency && (
                    <p className="text-primary-foreground/60 text-sm">
                      {secondary.agency}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Fallback: Brand stat card if only one testimonial */
              <div className="bg-primary flex min-h-70 flex-col items-center justify-center rounded-2xl p-8 text-center md:min-h-85">
                <p className="text-primary-foreground text-4xl font-bold lg:text-5xl">
                  {t('marketing:proofStrip.item1')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
