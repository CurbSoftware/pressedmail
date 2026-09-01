'use client';

import { useCallback, useMemo, useTransition } from 'react';

import { usePathname } from 'next/navigation';

import { useLocale } from 'next-intl';

import { useRouter } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shadcn/select';

interface LanguageSelectorProps {
  locales?: string[];
  defaultLocale?: string;
  cookieName?: string;
  onChange?: (locale: string) => unknown;
}

export function LanguageSelector({
  locales = [],
  defaultLocale,
  cookieName = 'lang',
  onChange,
}: LanguageSelectorProps) {
  const currentLocale = useLocale();
  const resolvedDefaultLocale = defaultLocale ?? locales[0] ?? currentLocale;
  const handleChangeLocale = useChangeLocale({
    locales,
    defaultLocale: resolvedDefaultLocale,
    cookieName,
  });

  const languageNames = useMemo(() => {
    return new Intl.DisplayNames([currentLocale], {
      type: 'language',
    });
  }, [currentLocale]);

  const languageChanged = useCallback(
    (locale: string | null) => {
      if (!locale) return;

      if (onChange) {
        onChange(locale);
      }

      handleChangeLocale(locale);
    },
    [onChange, handleChangeLocale],
  );

  if (locales.length <= 1) {
    return null;
  }

  return (
    <Select value={currentLocale} onValueChange={languageChanged}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {locales.map((locale) => {
          const label = capitalize(languageNames.of(locale) ?? locale);

          return (
            <SelectItem value={locale} key={locale}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function capitalize(lang: string) {
  return lang.slice(0, 1).toUpperCase() + lang.slice(1);
}

function useChangeLocale({
  locales,
  defaultLocale,
  cookieName,
}: {
  locales: string[];
  defaultLocale: string;
  cookieName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  return useCallback(
    (locale: string) => {
      document.cookie = `${cookieName}=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

      startTransition(() => {
        const newPathname = buildLocalePath({
          pathname,
          locale,
          defaultLocale,
          locales,
        });

        router.replace(newPathname);
        router.refresh();
      });
    },
    [cookieName, defaultLocale, locales, pathname, router],
  );
}

export function buildLocalePath({
  pathname,
  locale,
  defaultLocale,
  locales,
}: {
  pathname: string;
  locale: string;
  defaultLocale: string;
  locales: string[];
}) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] && locales.includes(segments[0])) {
    segments.shift();
  }

  const rest = segments.length > 0 ? `/${segments.join('/')}` : '';

  return locale === defaultLocale ? rest || '/' : `/${locale}${rest}`;
}
