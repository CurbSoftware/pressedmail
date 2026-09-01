/**
 * Product-neutral Tailwind semantic-color overrides.
 *
 * Tailwind 4 may compile utility colors to static values. Consumers therefore
 * inject their own application and portal selectors; this module never assumes
 * a product root and never writes an unscoped selector.
 */
import type { ThemeColorVariables } from '../types/colors';
import { removeStyleElement, replaceStyleElement } from './style-manager';

export interface OverrideCssOptions {
  /** Selectors that own the themed application and its portal surfaces. */
  scopeSelectors: readonly string[];
  /** Unique style element ID when applying the generated stylesheet. */
  styleElementId?: string;
}

const DEFAULT_OVERRIDE_STYLE_ID = 'kit-theme-overrides';

function normalizedSelectors(selectors: readonly string[]): string[] {
  const normalized = [
    ...new Set(selectors.map((selector) => selector.trim())),
  ].filter(Boolean);

  if (normalized.length === 0) {
    throw new Error('At least one appearance scope selector is required.');
  }

  return normalized;
}

function scope(selectors: readonly string[], childSelector = ''): string {
  return normalizedSelectors(selectors)
    .map((selector) => `${selector}${childSelector ? ` ${childSelector}` : ''}`)
    .join(',\n');
}

function rule(
  selectors: readonly string[],
  childSelector: string,
  declaration: string,
): string {
  return `${scope(selectors, childSelector)} {\n  ${declaration}\n}`;
}

/** Generate a stylesheet that is wholly confined to the supplied selectors. */
export function generateOverrideCss(
  variables: ThemeColorVariables,
  options: OverrideCssOptions,
): string {
  const selectors = normalizedSelectors(options.scopeSelectors);
  const v = variables;
  const rules = [
    rule(
      selectors,
      '',
      `background-color: ${v['--background']} !important;\n  color: ${v['--foreground']} !important;`,
    ),
    rule(
      selectors,
      '.bg-background',
      `background-color: ${v['--background']} !important;`,
    ),
    rule(selectors, '.bg-card', `background-color: ${v['--card']} !important;`),
    rule(
      selectors,
      '.bg-popover',
      `background-color: ${v['--popover']} !important;`,
    ),
    rule(
      selectors,
      '.bg-muted',
      `background-color: ${v['--muted']} !important;`,
    ),
    ...[30, 40, 50, 60].map((opacity) =>
      rule(
        selectors,
        `.bg-muted\\/${opacity}`,
        `background-color: color-mix(in oklch, ${v['--muted']} ${opacity}%, transparent) !important;`,
      ),
    ),
    rule(
      selectors,
      '.bg-accent',
      `background-color: ${v['--accent']} !important;`,
    ),
    rule(
      selectors,
      '.bg-accent\\/50',
      `background-color: color-mix(in oklch, ${v['--accent']} 50%, transparent) !important;`,
    ),
    rule(
      selectors,
      '.bg-primary',
      `background-color: ${v['--primary']} !important;`,
    ),
    ...[5, 10, 20, 90].map((opacity) =>
      rule(
        selectors,
        `.bg-primary\\/${opacity}`,
        `background-color: color-mix(in oklch, ${v['--primary']} ${opacity}%, transparent) !important;`,
      ),
    ),
    rule(
      selectors,
      '.bg-secondary',
      `background-color: ${v['--secondary']} !important;`,
    ),
    rule(
      selectors,
      '.bg-destructive',
      `background-color: ${v['--destructive']} !important;`,
    ),
    rule(
      selectors,
      '.bg-success',
      `background-color: ${v['--success']} !important;`,
    ),
    rule(
      selectors,
      '.bg-warning',
      `background-color: ${v['--warning']} !important;`,
    ),
    rule(selectors, '.bg-info', `background-color: ${v['--info']} !important;`),
    rule(
      selectors,
      '.text-foreground',
      `color: ${v['--foreground']} !important;`,
    ),
    rule(
      selectors,
      '.text-card-foreground',
      `color: ${v['--card-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.text-popover-foreground',
      `color: ${v['--popover-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.text-muted-foreground',
      `color: ${v['--muted-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.placeholder\\:text-muted-foreground::placeholder',
      `color: ${v['--muted-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.text-accent-foreground',
      `color: ${v['--accent-foreground']} !important;`,
    ),
    rule(selectors, '.text-primary', `color: ${v['--primary']} !important;`),
    rule(
      selectors,
      '.text-primary-foreground',
      `color: ${v['--primary-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.text-secondary-foreground',
      `color: ${v['--secondary-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.text-destructive',
      `color: ${v['--destructive']} !important;`,
    ),
    rule(
      selectors,
      '.text-destructive-foreground',
      `color: ${v['--destructive-foreground']} !important;`,
    ),
    rule(selectors, '.text-success', `color: ${v['--success']} !important;`),
    rule(
      selectors,
      '.text-success-foreground',
      `color: ${v['--success-foreground']} !important;`,
    ),
    rule(selectors, '.text-warning', `color: ${v['--warning']} !important;`),
    rule(
      selectors,
      '.text-warning-foreground',
      `color: ${v['--warning-foreground']} !important;`,
    ),
    rule(selectors, '.text-info', `color: ${v['--info']} !important;`),
    rule(
      selectors,
      '.text-info-foreground',
      `color: ${v['--info-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.border-border',
      `border-color: ${v['--border']} !important;`,
    ),
    rule(
      selectors,
      '.border-input',
      `border-color: ${v['--input']} !important;`,
    ),
    rule(
      selectors,
      '.border-input\\/50',
      `border-color: color-mix(in oklch, ${v['--input']} 50%, transparent) !important;`,
    ),
    rule(
      selectors,
      '.border-primary',
      `border-color: ${v['--primary']} !important;`,
    ),
    ...[20, 50].map((opacity) =>
      rule(
        selectors,
        `.border-primary\\/${opacity}`,
        `border-color: color-mix(in oklch, ${v['--primary']} ${opacity}%, transparent) !important;`,
      ),
    ),
    rule(
      selectors,
      '.border-destructive',
      `border-color: ${v['--destructive-border']} !important;`,
    ),
    rule(
      selectors,
      '.border-success',
      `border-color: ${v['--success-border']} !important;`,
    ),
    rule(
      selectors,
      '.border-warning',
      `border-color: ${v['--warning-border']} !important;`,
    ),
    rule(
      selectors,
      '.border-info',
      `border-color: ${v['--info-border']} !important;`,
    ),
    rule(
      selectors,
      '[data-slot="checkbox"]',
      `border-color: ${v['--checkbox-border']} !important;\n  background-color: ${v['--checkbox-background']} !important;`,
    ),
    rule(
      selectors,
      '[data-slot="checkbox"][data-state="checked"]',
      `background-color: var(--checkbox-checked-background, ${v['--checkbox-checked-background']}) !important;\n  color: ${v['--checkbox-checked-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.ring-ring',
      `--tw-ring-color: ${v['--ring']} !important;`,
    ),
    rule(
      selectors,
      '.ring-primary',
      `--tw-ring-color: ${v['--primary']} !important;`,
    ),
    rule(
      selectors,
      '.focus-visible\\:ring-ring:focus-visible',
      `--tw-ring-color: ${v['--ring']} !important;`,
    ),
    rule(
      selectors,
      '.divide-border > :not([hidden]) ~ :not([hidden])',
      `border-color: ${v['--border']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-accent:hover',
      `background-color: ${v['--accent']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-accent\\/50:hover',
      `background-color: color-mix(in oklch, ${v['--accent']} 50%, transparent) !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-muted:hover',
      `background-color: ${v['--muted']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-muted\\/50:hover',
      `background-color: color-mix(in oklch, ${v['--muted']} 50%, transparent) !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-primary:hover',
      `background-color: ${v['--primary']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-primary\\/90:hover',
      `background-color: color-mix(in oklch, ${v['--primary']} 90%, ${v['--background']}) !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-primary\\/10:hover',
      `background-color: color-mix(in oklch, ${v['--primary']} 10%, transparent) !important;`,
    ),
    rule(
      selectors,
      '.hover\\:bg-secondary:hover',
      `background-color: ${v['--secondary']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:text-foreground:hover',
      `color: ${v['--foreground']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:text-accent-foreground:hover',
      `color: ${v['--accent-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:text-primary:hover',
      `color: ${v['--primary']} !important;`,
    ),
    rule(
      selectors,
      '.hover\\:border-primary:hover',
      `border-color: ${v['--primary']} !important;`,
    ),
    rule(
      selectors,
      '.focus\\:bg-accent:focus',
      `background-color: ${v['--accent']} !important;`,
    ),
    rule(
      selectors,
      '.focus\\:bg-background:focus',
      `background-color: ${v['--background']} !important;`,
    ),
    rule(
      selectors,
      '.focus\\:text-accent-foreground:focus',
      `color: ${v['--accent-foreground']} !important;`,
    ),
    rule(
      selectors,
      '.focus-within\\:ring-ring:focus-within',
      `--tw-ring-color: ${v['--ring']} !important;`,
    ),
    rule(
      selectors,
      '.focus-within\\:bg-background:focus-within',
      `background-color: ${v['--background']} !important;`,
    ),
    rule(
      selectors,
      '.focus-within\\:border-input:focus-within',
      `border-color: ${v['--input']} !important;`,
    ),
    rule(
      selectors,
      '.data-\\[state\\=active\\]\\:bg-background[data-state="active"]',
      `background-color: ${v['--background']} !important;`,
    ),
    rule(
      selectors,
      '.data-\\[state\\=active\\]\\:text-foreground[data-state="active"]',
      `color: ${v['--foreground']} !important;`,
    ),
    rule(selectors, '.fill-primary', `fill: ${v['--primary']} !important;`),
    rule(selectors, '.stroke-primary', `stroke: ${v['--primary']} !important;`),
  ];

  return `/* Theme overrides: generated for explicit appearance scopes. */\n${rules.join('\n\n')}\n`;
}

/** Apply scoped overrides and return a cleanup callback. */
export function applyOverrideCss(
  variables: ThemeColorVariables,
  options: OverrideCssOptions,
): () => void {
  const styleElementId = options.styleElementId ?? DEFAULT_OVERRIDE_STYLE_ID;
  return replaceStyleElement(
    styleElementId,
    generateOverrideCss(variables, options),
  );
}

/** Remove a previously applied scoped override stylesheet. */
export function clearOverrideCss(
  styleElementId = DEFAULT_OVERRIDE_STYLE_ID,
): void {
  removeStyleElement(styleElementId);
}
