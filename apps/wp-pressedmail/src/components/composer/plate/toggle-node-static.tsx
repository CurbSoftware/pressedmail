import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe static toggle. A toggle can't collapse in email, so we render the
 * summary line as a plain block; its nested content (sibling blocks with higher
 * indent) renders normally, i.e. always expanded. No interactive chrome.
 *
 * The marker is what lets a reopened draft rebuild the toggle: `serializeHtml`
 * renders through this component and never consults the plugin's legacy
 * serializer, so an attribute missing here is an attribute the draft loses.
 */
export function ToggleElementStatic(props: SlateElementProps) {
  return (
    <SlateElement
      {...props}
      attributes={{ ...props.attributes, 'data-pm-block': 'toggle' }}>
      {props.children}
    </SlateElement>
  );
}
