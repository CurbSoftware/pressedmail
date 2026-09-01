import React, { Fragment, createContext, useContext } from 'react';

/**
 * Minimal next-intl shim for non-Next.js plugin builds.
 *
 * This keeps shared @kit/ui components buildable inside the WordPress Vite apps.
 * It only supports locale context, plain placeholder interpolation, and simple
 * rich-tag replacement. It does not implement full ICU formatting or message lookup.
 */

type TranslationValues = Record<string, unknown>;

type TranslationFn = ((key: string, values?: TranslationValues) => string) & {
  rich: (key: string, values?: TranslationValues) => React.ReactNode;
  has: (key: string) => boolean;
};

const LocaleContext = createContext('en');

function resolveRichValue(
  value: unknown,
  children?: React.ReactNode,
): React.ReactNode {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'function') {
    return (value as (chunks: React.ReactNode) => React.ReactNode)(children ?? '');
  }

  if (React.isValidElement(value)) {
    if (children === undefined) {
      return value;
    }

    return React.cloneElement(value, undefined, children);
  }

  return String(value);
}

function interpolate(key: string, values?: TranslationValues): string {
  if (!values) {
    return key;
  }

  return key.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = values[name];

    if (
      value === null ||
      value === undefined ||
      typeof value === 'function' ||
      React.isValidElement(value)
    ) {
      return '';
    }

    return String(value);
  });
}

function renderRichText(
  message: string,
  values?: TranslationValues,
): React.ReactNode {
  if (!values) {
    return message;
  }

  const pattern = /<(\w+)>(.*?)<\/\1>|\{(\w+)\}/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of message.matchAll(pattern)) {
    const [fullMatch, tagName, tagChildren, placeholderName] = match;
    const matchIndex = match.index ?? 0;

    if (matchIndex > cursor) {
      nodes.push(message.slice(cursor, matchIndex));
    }

    if (tagName) {
      const childNode = renderRichText(tagChildren ?? '', values);
      nodes.push(resolveRichValue(values[tagName], childNode));
    } else if (placeholderName) {
      nodes.push(resolveRichValue(values[placeholderName]));
    }

    cursor = matchIndex + fullMatch.length;
  }

  if (cursor < message.length) {
    nodes.push(message.slice(cursor));
  }

  if (nodes.length === 0) {
    return interpolate(message, values);
  }

  if (nodes.length === 1) {
    return nodes[0];
  }

  return React.createElement(Fragment, null, ...nodes);
}

export function NextIntlClientProvider({
  locale = 'en',
  children,
}: {
  locale?: string;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): string {
  return useContext(LocaleContext);
}

export function useTranslations(_namespace?: string): TranslationFn {
  const translate = ((key: string, values?: TranslationValues) =>
    interpolate(key, values)) as TranslationFn;

  translate.rich = (key: string, values?: TranslationValues) =>
    renderRichText(key, values);
  translate.has = () => false;

  return translate;
}