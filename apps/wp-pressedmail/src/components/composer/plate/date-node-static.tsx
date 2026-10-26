import type { TDateElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';
import { __ } from '@wordpress/i18n';

import { emailDateLabel } from '@/lib/composer/email-date-label';

/** A stored date: ISO-like, short, and never markup. */
const DATE_MARKER = /^[0-9A-Za-z:+. /-]{1,64}$/;

/**
 * Reads back the chip DateElementStatic writes, so a draft reopened from its
 * HTML keeps its date chip. Without it the marked span read as plain text: the
 * label, plus the void's hidden spacer as a stray transparent character. The
 * live editor and the static parser share it.
 */
export const dateChipHtmlParsers = {
  html: {
    deserializer: {
      rules: [{ validAttribute: { 'data-pm-block': ['date'] } }],
      // The label and Plate's hidden void text are not authored content.
      withoutChildren: true,
      parse: ({ element, type }: { element: HTMLElement; type: string }) => {
        const date = element.getAttribute('data-date') ?? '';
        return { type, ...(DATE_MARKER.test(date) ? { date } : {}) };
      },
    },
  },
};

/**
 * Email-safe static inline date: renders the absolute date as plain inline text
 * (no editor chrome), never the editor's relative "Today", which is wrong by the
 * time someone reads it. Classes are stripped on serialize, so styling stays
 * minimal/inline.
 */
export function DateElementStatic(props: SlateElementProps<TDateElement>) {
  const { element } = props;

  return (
    <SlateElement
      as="span"
      {...props}
      attributes={{
        ...props.attributes,
        'data-pm-block': 'date',
        ...(element.date ? { 'data-date': String(element.date) } : {}),
      }}>
      <span>
        {emailDateLabel(element) || __('Pick a date', 'pressedmail')}
      </span>
      {props.children}
    </SlateElement>
  );
}
