'use client';

import { useState } from 'react';

import Link from 'next/link';

import { cn } from '#utils';
import { ChevronDown, HelpCircle, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  UMAMI_EVENTS,
  trackUmamiEvent,
  umamiClick,
} from '@kit/shared/analytics';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shadcn/accordion';
import { Button } from '../../shadcn/button';

// Top 3 most critical FAQs for mobile (pricing/trust objections)
const MOBILE_FAQ_COUNT = 3;

export type FaqItem = {
  id: string;
  slug: string;
  question: string;
  answer: string;
};

export interface FaqSectionClientProps {
  faqs: FaqItem[];
  /**
   * Custom render function for FAQ answers.
   * Apps should provide their own renderer that sanitizes HTML
   * and wraps content in appropriate video hydrators.
   */
  renderAnswer: (answer: string) => React.ReactNode;
  className?: string;
}

export function FaqSectionClient({
  faqs,
  renderAnswer,
  className,
}: FaqSectionClientProps) {
  const t = useTranslations('marketing');
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const hasMoreFaqs = faqs.length > MOBILE_FAQ_COUNT;

  return (
    <section
      className={cn(
        'site-faq relative overflow-hidden border-t border-[color:var(--surface-border)] bg-[var(--surface-section)] py-16 md:py-24 lg:py-32',
        className,
      )}
    >
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-primary/3 absolute bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-[100px]" />
      </div>

      <div className="relative container">
        {/* Section Header */}
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-16">
          <div className="border-border bg-muted/50 mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2">
            <HelpCircle
              className="text-muted-foreground h-4 w-4"
              aria-hidden="true"
            />
            <span className="text-muted-foreground text-sm font-medium">
              {t('faqSection.badge')}
            </span>
          </div>

          <h2 className="font-heading text-foreground mb-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {t('faqSection.heading')}
          </h2>

          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            {t('faqSection.subheading')}
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="mx-auto max-w-3xl">
          <Accordion
            type="single"
            collapsible
            className="w-full space-y-3"
            // Radix reports the open item, and an empty string on collapse.
            // Only openings are interesting: which questions people needed
            // answered before buying.
            onValueChange={(value) => {
              if (!value) {
                return;
              }

              const opened = faqs.find((faq) => `item-${faq.id}` === value);

              trackUmamiEvent(UMAMI_EVENTS.faqOpened, {
                'faq-id': opened?.slug ?? value,
              });
            }}
          >
            {faqs.map((item, index) => {
              // On mobile, hide items beyond the top 3 unless expanded
              const isHiddenOnMobile =
                !showAllFaqs && hasMoreFaqs && index >= MOBILE_FAQ_COUNT;

              return (
                <AccordionItem
                  key={item.id}
                  value={`item-${item.id}`}
                  className={cn(
                    'rounded-xl border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-chrome)] px-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition-colors sm:px-6',
                    isHiddenOnMobile && 'hidden lg:block',
                  )}
                >
                  <AccordionTrigger className="text-foreground py-4 text-left text-sm font-semibold hover:no-underline sm:py-5 sm:text-base">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 text-sm sm:pb-5 sm:text-base">
                    {renderAnswer(item.answer)}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* View All FAQs button - mobile only */}
          {hasMoreFaqs && (
            <div className="mt-6 flex justify-center lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllFaqs(!showAllFaqs)}
                className="gap-2 rounded-full"
                aria-expanded={showAllFaqs}
                {...umamiClick(UMAMI_EVENTS.tabSelected, {
                  'tab-group': 'faq-visibility',
                  'tab-id': showAllFaqs ? 'show-less' : 'view-all',
                })}
              >
                {showAllFaqs
                  ? t('faqSection.showLess')
                  : t('faqSection.viewAll', { count: faqs.length })}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    showAllFaqs && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </Button>
            </div>
          )}
        </div>

        {/* Contact CTA */}
        <div className="mx-auto mt-12 max-w-xl text-center">
          <p className="text-muted-foreground mb-4 text-sm sm:text-base">
            {t('faqSection.stillHaveQuestions')}
          </p>
          <Button
            asChild
            variant="outline"
            className="border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Link
              href="/contact"
              {...umamiClick(UMAMI_EVENTS.ctaClicked, {
                'cta-id': 'faq-contact-support',
                'cta-location': 'faq',
                'cta-target': '/contact',
              })}
            >
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('faqSection.contactSupport')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
