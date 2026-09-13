import { getDateDisplayLabel } from '@kit/plate/date';
import type { TDateElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';
import { __ } from '@wordpress/i18n';

/**
 * Email-safe static inline date: renders the formatted date label as plain
 * inline text (no editor chrome). Classes are stripped on serialize, so styling
 * stays minimal/inline.
 */
export function DateElementStatic(props: SlateElementProps<TDateElement>) {
  const { element } = props;

  return (
    <SlateElement as="span" {...props}>
      <span>
        {element.date || element.rawDate
          ? getDateDisplayLabel(element)
          : __('Pick a date', 'pressedmail')}
      </span>
      {props.children}
    </SlateElement>
  );
}
