/**
 * Translation function type for server components.
 * Apps pass their own `t` function from `createI18nServerInstance()`.
 */
export type TranslationFn = (
  key: string,
  values?: Record<string, Date | number | string>,
) => string;

/**
 * Common props for marketing sections that need server-side translations.
 */
export interface ServerSectionProps {
  t: TranslationFn;
  className?: string;
}

/**
 * A call-to-action target. Paid products pass explicit primary/secondary CTAs
 * (checkout, /features, /pricing) instead of the deprecated `freePluginUrl`.
 */
export interface CtaTarget {
  href: string;
  label: string;
  external?: boolean;
}
