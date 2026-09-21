import type { ReactNode } from 'react';

import { useTranslations } from 'next-intl';

import { ErrorBoundary } from './error-boundary';

type TransProps = {
  /**
   * The message key. `namespace:key` and `namespace.key` both work; the first
   * separator splits it. Callers that pass `ns` keep the whole string as key.
   */
  i18nKey: string | undefined;
  /** Shown when the key is missing, or when lookup throws. */
  defaults?: ReactNode;
  /** Interpolated into the message. */
  values?: Record<string, unknown>;
  /** Namespace, when the key should not be split. */
  ns?: string;
};

function splitKey(i18nKey: string, ns?: string) {
  if (ns) return { namespace: ns, key: i18nKey };

  const separator = [i18nKey.indexOf(':'), i18nKey.indexOf('.')].find(
    (index) => index > 0,
  );

  return separator === undefined
    ? { namespace: undefined, key: i18nKey }
    : {
        namespace: i18nKey.slice(0, separator),
        key: i18nKey.slice(separator + 1),
      };
}

function Message({ i18nKey, defaults, values, ns }: TransProps) {
  const { namespace, key } = splitKey(i18nKey ?? '', ns);
  const t = useTranslations(namespace);

  try {
    if (defaults !== undefined && !t.has(key as never)) return defaults;

    return values ? t(key as never, values as never) : t(key as never);
  } catch {
    // A malformed ICU message throws at format time, not lookup time. Showing
    // the raw key beats taking the screen down over a bad string.
    return defaults ?? i18nKey;
  }
}

/**
 * Renders one translated message.
 *
 * `useTranslations` throws when no provider is mounted above it, which happens
 * in the WordPress plugin, where shared components render outside the website's
 * i18n tree. The boundary turns that into the default text.
 */
export function Trans({ i18nKey, defaults, values, ns }: TransProps) {
  return (
    <ErrorBoundary fallback={<>{defaults ?? i18nKey}</>}>
      <Message i18nKey={i18nKey} defaults={defaults} values={values} ns={ns} />
    </ErrorBoundary>
  );
}
