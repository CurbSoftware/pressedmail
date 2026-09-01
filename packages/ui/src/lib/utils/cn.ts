import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `clsx` + `tailwind-merge`, taught the project's own type scale.
 *
 * Plain `twMerge` only knows Tailwind's stock font sizes. Every custom one in
 * `theme.css` (`text-mono-xs`, `text-utility`, `text-stat`, `text-copy-sm` and
 * the rest) looks to it like `text-<colour>`, so it puts them in the text-color
 * group. Two classes in one group means the later one wins, and the size is
 * dropped from the output entirely:
 *
 *   cn('text-mono-xs', 'text-accent-cyan')  ->  'text-accent-cyan'
 *   cn('text-stat tabular-nums', 'text-destructive') -> 'tabular-nums text-destructive'
 *
 * Nothing errors; the element silently falls back to the inherited 16px. That
 * is what every `<Mono>`, `<SectionLabel>`, `<Copy>` and `<Lede>` on the
 * marketing sites was doing, because each builds its class list as
 * `cn(size, tone)`: measured on /features, a `text-mono-xs` folio that should
 * render at 12px was rendering at 16.
 *
 * Listing the sizes here fixes it at the one place every app already imports,
 * rather than asking every caller to keep size and colour on separate
 * elements. Keep this list in step with the `--text-*` tokens in
 * `theme.css`; a token that is missing here is a size that silently disappears
 * whenever it meets a colour.
 */
const FONT_SIZES = [
  '2xs',
  'xs-sm',
  'copy',
  'copy-sm',
  'lede',
  'mono',
  'mono-xs',
  'utility',
  'utility-xs',
  'stat',
  'stat-lg',
  'editorial-sm',
  'editorial-md',
  'editorial-lg',
  'display-md',
  'display-lg',
  'display-xl',
  'display-hero',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
