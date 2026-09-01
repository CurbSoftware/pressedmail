import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe static toggle. A toggle can't collapse in email, so we render the
 * summary line as a plain block; its nested content (sibling blocks with higher
 * indent) renders normally, i.e. always expanded. No interactive chrome.
 */
export function ToggleElementStatic(props: SlateElementProps) {
  return <SlateElement {...props}>{props.children}</SlateElement>;
}
