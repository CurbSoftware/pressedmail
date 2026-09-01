'use client';

import Link from 'next/link';

import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '#utils';

export function VersionPill({
  version,
  className,
}: {
  version: string | null;
  className?: string;
}) {
  const t = useTranslations('marketing');
  const displayVersion = version ?? '1.0.0';

  return (
    <div
      className={cn(
        'border-primary/20 bg-card/60 inline-flex items-center gap-2 rounded-full border px-4 py-2 shadow-lg backdrop-blur-sm lg:gap-2.5 lg:px-5 lg:py-2.5',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
        <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
      </span>
      <span className="text-foreground/90 text-sm font-medium">
        {t('versionPill.announcement', { version: displayVersion })}
      </span>
      <Link
        href="/changelog"
        className="text-foreground/70 hover:text-foreground transition-colors"
      >
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
