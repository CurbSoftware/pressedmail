import type {
  TAudioElement,
  TFileElement,
  TMediaEmbedElement,
  TVideoElement,
} from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';
import { __ } from '@wordpress/i18n';

import { safeMediaUrl } from './safe-media-url';

/**
 * Email-safe static media. Email clients can't play inline <video>/<audio>, so
 * video and audio serialize to plain links; files are download links. All
 * styling inline (survives stripClassNames). A URL that is not http(s)
 * serializes as an anchor with no href.
 */
const LINK_STYLE = { color: '#0066cc', textDecoration: 'underline' } as const;

export function VideoElementStatic(props: SlateElementProps<TVideoElement>) {
  const { url } = props.element;
  return (
    <SlateElement {...props} as="div">
      <a href={safeMediaUrl(url)} rel="noopener noreferrer" style={LINK_STYLE} target="_blank">
        {__('Video', 'pressedmail')}
      </a>
      {props.children}
    </SlateElement>
  );
}

export function AudioElementStatic(props: SlateElementProps<TAudioElement>) {
  const { url } = props.element;
  return (
    <SlateElement {...props} as="div">
      <a href={safeMediaUrl(url)} rel="noopener noreferrer" style={LINK_STYLE} target="_blank">
        {__('Audio', 'pressedmail')}
      </a>
      {props.children}
    </SlateElement>
  );
}

export function MediaEmbedElementStatic(
  props: SlateElementProps<TMediaEmbedElement>,
) {
  const { url } = props.element;
  return (
    <SlateElement {...props} as="div">
      <a href={safeMediaUrl(url)} rel="noopener noreferrer" style={LINK_STYLE} target="_blank">
        {url}
      </a>
      {props.children}
    </SlateElement>
  );
}

export function PlaceholderElementStatic(props: SlateElementProps) {
  // Transient upload node, must never reach a sent email.
  return <>{props.children}</>;
}

export function FileElementStatic(props: SlateElementProps<TFileElement>) {
  const { name, url } = props.element;
  return (
    <SlateElement {...props} as="div">
      <a
        download={name}
        href={safeMediaUrl(url)}
        rel="noopener noreferrer"
        style={LINK_STYLE}
        target="_blank"
      >
        {name || __('File', 'pressedmail')}
      </a>
      {props.children}
    </SlateElement>
  );
}
