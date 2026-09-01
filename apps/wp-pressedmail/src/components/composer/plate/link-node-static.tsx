import { getLinkAttributes } from '@kit/plate/link';
import type { TLinkElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function getSafeHref(href: unknown) {
  if (typeof href !== 'string') return null;
  const value = href.trim();

  if (!value) return null;
  if (value.toLowerCase().startsWith('mailto:')) return value;
  if (value.toLowerCase().startsWith('tel:')) return value;

  try {
    const parsed = new URL(value);
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? value : null;
  } catch {
    return null;
  }
}

export function LinkElementStatic(props: SlateElementProps<TLinkElement>) {
  const attributes = getLinkAttributes(props.editor, props.element);
  const href = getSafeHref(attributes.href);

  if (!href) {
    return <SlateElement {...props}>{props.children}</SlateElement>;
  }

  return (
    <SlateElement
      {...props}
      as="a"
      attributes={{
        ...props.attributes,
        ...attributes,
        href,
      }}
      style={{
        color: '#1d4ed8',
        textDecoration: 'underline',
      }}
    >
      {props.children}
    </SlateElement>
  );
}
