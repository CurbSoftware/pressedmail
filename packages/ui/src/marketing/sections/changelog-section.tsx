import Link from 'next/link';

import { ArrowRightIcon } from 'lucide-react';

import { cn } from '#utils';

import type { ServerSectionProps } from './types';

export interface ChangelogItem {
  id: string;
  slug: string;
  title: string;
  description?: string;
  publishedAt: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date
    .toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    .toUpperCase();
}

export interface ChangelogSectionProps extends ServerSectionProps {
  items: ChangelogItem[];
}

export function ChangelogSection({
  t,
  items,
  className,
}: ChangelogSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={cn('py-20 md:py-28 lg:py-36', className)}>
      <div className="container">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-foreground mb-12 text-3xl font-bold tracking-tight sm:text-4xl md:mb-16 lg:text-5xl">
            {t('marketing:changelog')}
          </h2>

          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {/* Continuous timeline line (desktop) */}
            <div
              className="border-muted-foreground/40 pointer-events-none absolute right-0 left-0 hidden border-t lg:block"
              style={{ top: '0.3125rem' }}
            />

            {items.map((item, index) => (
              <Link
                key={item.id}
                href={`/changelog/${item.slug}`}
                className="group flex flex-col gap-6 lg:px-6 lg:first:pl-0 lg:last:pr-0"
              >
                {/* Timeline dot + line */}
                <div className="relative flex items-center">
                  {index === 0 ? (
                    <span className="relative z-10 flex h-4 w-4 shrink-0">
                      <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                      <span className="bg-primary relative inline-flex h-3.5 w-3.5 rounded-full" />
                    </span>
                  ) : (
                    <span className="bg-primary/50 relative z-10 h-3 w-3 shrink-0 rounded-full" />
                  )}
                  <span className="border-muted-foreground/40 ml-2 h-0 flex-1 border-t lg:hidden" />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-2">
                  <h3 className="text-foreground text-sm leading-tight font-semibold group-hover:underline">
                    {item.title}
                  </h3>

                  {item.description && (
                    <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  <span className="text-muted-foreground/60 mt-2 font-mono text-xs tracking-wider">
                    {formatDate(item.publishedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* See all releases + roadmap links */}
          <div className="mt-10 flex items-center gap-6 md:mt-14">
            <Link
              href="/changelog"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              {t('marketing:changelogSection.seeAll')}
              <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            <Link
              href="/roadmap"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
            >
              {t('marketing:changelogSection.seeRoadmap')}
              <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
