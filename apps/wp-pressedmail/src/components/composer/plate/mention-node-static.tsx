import type { TMentionElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe static mention: renders as plain inline `@name` text. The
 * inline chip styling is editor-only; in email it degrades to readable text.
 */
export function MentionElementStatic(
  props: SlateElementProps<TMentionElement>,
) {
  return (
    <SlateElement {...props} as="span">
      @{props.element.value}
      {props.children}
    </SlateElement>
  );
}
