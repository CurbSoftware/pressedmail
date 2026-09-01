'use client';

import { cn } from '#utils';
import type { LucideIcon } from 'lucide-react';
import { MousePointerClick, ShoppingCart, UserCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shadcn/accordion';
import { ScreenshotMockupFrame } from '../screenshot-mockup-frame';

export interface CustomerContextAccordionItem {
  value: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

export interface CustomerContextSectionProps {
  accordionItems?: CustomerContextAccordionItem[];
  mockup?: React.ReactNode;
  className?: string;
}

const DEFAULT_ACCORDION_ITEMS: CustomerContextAccordionItem[] = [
  {
    value: 'item-woocommerce',
    icon: ShoppingCart,
    titleKey: 'customerContext.wooTitle',
    descKey: 'customerContext.wooDesc',
  },
  {
    value: 'item-user-profiles',
    icon: UserCircle,
    titleKey: 'customerContext.userProfilesTitle',
    descKey: 'customerContext.userProfilesDesc',
  },
  {
    value: 'item-quick-actions',
    icon: MousePointerClick,
    titleKey: 'customerContext.quickActionsTitle',
    descKey: 'customerContext.quickActionsDesc',
  },
];

function DefaultCustomerContextMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-xl bg-[var(--glow-primary-soft)] blur-[40px]" />

      <ScreenshotMockupFrame
        label="Context Panel"
        className="relative rounded-xl border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-chrome)] shadow-[var(--shadow-card)] backdrop-blur-sm"
        contentClassName="bg-[var(--surface-card)]"
        dotClassName="h-3 w-3"
        labelClassName="text-muted-foreground/40"
      >
        {/* Contact header */}
        <div className="border-border/30 border-b p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/15 text-primary flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
              JD
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">Jane Doe</p>
              <p className="text-muted-foreground text-xs">jane@example.com</p>
            </div>
          </div>
        </div>

        {/* WP User info */}
        <div className="border-border/30 space-y-2 border-b p-4">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            WordPress User
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Role: </span>
              <span className="text-foreground font-medium">Customer</span>
            </div>
            <div>
              <span className="text-muted-foreground">Since: </span>
              <span className="text-foreground font-medium">Jan 2024</span>
            </div>
          </div>
        </div>

        {/* WooCommerce orders */}
        <div className="space-y-2 p-4">
          <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Recent Orders
          </p>
          <div className="space-y-1.5">
            <div className="border-border/40 flex justify-between rounded-md border p-2 text-xs">
              <span className="text-foreground font-medium">#1042</span>
              <span className="text-success font-medium">$156.00</span>
            </div>
            <div className="border-border/40 flex justify-between rounded-md border p-2 text-xs">
              <span className="text-foreground font-medium">#1038</span>
              <span className="text-success font-medium">$2,400.00</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Lifetime Value</span>
            <span className="text-primary font-bold">$4,156.00</span>
          </div>
        </div>
      </ScreenshotMockupFrame>
    </div>
  );
}

export function CustomerContextSection({
  accordionItems = DEFAULT_ACCORDION_ITEMS,
  mockup,
  className,
}: CustomerContextSectionProps) {
  const t = useTranslations('marketing');

  return (
    <section
      className={cn(
        'relative overflow-hidden py-20 md:py-28 lg:py-36',
        className,
      )}
    >
      <div className="relative z-10 container">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left: Text + Accordion */}
            <div className="space-y-6 lg:space-y-8">
              <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                {t('customerContext.heading')}
              </h2>

              <p className="text-muted-foreground text-base leading-relaxed md:text-lg">
                {t('customerContext.description')}
              </p>

              <Accordion
                type="single"
                collapsible
                defaultValue="item-woocommerce"
                className="w-full space-y-3"
              >
                {accordionItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <AccordionItem
                      key={item.value}
                      value={item.value}
                      className="rounded-xl border border-[color:var(--surface-card-border)] bg-[var(--surface-card)] bg-[image:var(--card-chrome)] px-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition-colors sm:px-6"
                    >
                      <AccordionTrigger className="text-foreground py-4 text-left text-sm font-semibold hover:no-underline sm:py-5 sm:text-base">
                        <span className="flex items-center gap-3">
                          <span className="bg-primary/10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                            <Icon
                              className="text-primary h-4 w-4"
                              aria-hidden="true"
                            />
                          </span>
                          {t(item.titleKey)}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4 text-sm leading-relaxed sm:pb-5 sm:text-base">
                        {t(item.descKey)}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Right: Mockup */}
            <div className="relative">
              {mockup ?? <DefaultCustomerContextMockup />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
