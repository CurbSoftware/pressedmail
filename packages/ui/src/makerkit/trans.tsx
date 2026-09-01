import React from 'react';

import { useTranslations } from 'next-intl';

import { ErrorBoundary } from './error-boundary';

interface TransProps {
  /**
   * The i18n key to translate. Supports dot notation for nested keys.
   * Example: 'auth.login.title' or 'common.buttons.submit'
   */
  i18nKey: string | undefined;
  /**
   * Default text to use if the translation key is not found.
   */
  defaults?: React.ReactNode;
  /**
   * Values to interpolate into the translation.
   * Example: { name: 'John' } for a translation like "Hello {name}"
   */
  values?: Record<string, unknown>;
  /**
   * The translation namespace (optional, will be extracted from i18nKey if not provided).
   */
  ns?: string;
  /**
   * Components to use for rich text interpolation.
   * Can be either:
   * - A function: (chunks) => <strong>{chunks}</strong>
   * - A React element: <strong /> (for backward compatibility)
   */
  components?: Record<
    string,
    | ((chunks: React.ReactNode) => React.ReactNode)
    | React.ReactElement
    | React.ComponentType
  >;
}

/**
 * Trans component for displaying translated text using next-intl.
 * Provides backward compatibility with i18next Trans component API.
 */
export function Trans({
  i18nKey,
  defaults,
  values,
  ns,
  components,
}: TransProps) {
  return (
    <ErrorBoundary fallback={<>{defaults ?? i18nKey}</>}>
      <Translate
        i18nKey={i18nKey!}
        defaults={defaults}
        values={values}
        ns={ns}
        components={components}
      />
    </ErrorBoundary>
  );
}

function Translate({ i18nKey, defaults, values, ns, components }: TransProps) {
  // Extract namespace and key from i18nKey
  // Supports both "namespace:key" (i18next) and "namespace.key" (next-intl) formats
  const rawKey = i18nKey || '';
  const colonIndex = rawKey.indexOf(':');
  const dotIndex = rawKey.indexOf('.');

  let translationNamespace: string;
  let key: string;

  if (ns) {
    translationNamespace = ns;
    key = rawKey;
  } else if (colonIndex > 0) {
    translationNamespace = rawKey.slice(0, colonIndex);
    key = rawKey.slice(colonIndex + 1);
  } else if (dotIndex > 0) {
    translationNamespace = rawKey.slice(0, dotIndex);
    key = rawKey.slice(dotIndex + 1);
  } else {
    translationNamespace = '';
    key = rawKey;
  }

  // Get translations for the namespace
  const t = useTranslations(translationNamespace || undefined);

  // Use rich text translation if components are provided
  if (components) {
    // Convert React elements to functions for next-intl compatibility
    const normalizedComponents = Object.entries(components).reduce(
      (acc, [key, value]) => {
        // If it's already a function, use it directly
        if (typeof value === 'function' && !React.isValidElement(value)) {
          acc[key] = value as (
            chunks: React.ReactNode,
          ) => React.ReactNode | React.ReactElement;
        }
        // If it's a React element, clone it with chunks as children
        else if (React.isValidElement(value)) {
          acc[key] = (chunks: React.ReactNode) => {
            // If the element already has children (like nested Trans components),
            // preserve them instead of replacing with chunks
            const element = value as React.ReactElement<{
              children?: React.ReactNode;
            }>;

            if (element.props.children) {
              return element;
            }

            // Otherwise, clone the element with chunks as children
            return React.cloneElement(element, {}, chunks);
          };
        } else {
          acc[key] = value as (
            chunks: React.ReactNode,
          ) => React.ReactNode | React.ReactElement;
        }
        return acc;
      },
      {} as Record<
        string,
        (chunks: React.ReactNode) => React.ReactNode | React.ReactElement
      >,
    );

    let translation: React.ReactNode;

    try {
      if (!t.has(key as never) && defaults) {
        return defaults;
      }

      // Merge values and normalized components for t.rich()
      // Components take precedence over values with the same name
      const richParams = {
        ...values,
        ...normalizedComponents,
      };

      translation = t.rich(key as never, richParams as never);
    } catch {
      // Fallback to defaults or i18nKey if translation fails
      translation = defaults ?? i18nKey;
    }

    return translation;
  }

  // Regular translation without components
  let translation: React.ReactNode;

  try {
    if (!t.has(key as never) && defaults) {
      return defaults;
    }

    translation = values ? t(key as never, values as never) : t(key as never);
  } catch {
    // Fallback to defaults or i18nKey if translation fails
    translation = defaults ?? i18nKey;
  }

  return translation;
}
