import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe divider. Without a static component the void serialized to an
 * empty block, so a divider (and the line above a reply's quote) never reached
 * the recipient. Send preparation gives the rule its inline border.
 */
export function HrElementStatic(props: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <hr />
      {props.children}
    </SlateElement>
  );
}
