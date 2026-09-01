import type {
  TAudioElement,
  TFileElement,
  TMediaEmbedElement,
  TVideoElement,
} from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe static media. Email clients can't play inline <video>/<audio>, so
 * video and audio serialize to plain links; files are download links. All
 * styling inline (survives stripClassNames).
 */
const LINK_STYLE = { color: '#0066cc', textDecoration: 'underline' } as const;

export function VideoElementStatic(props: SlateElementProps<TVideoElement>) {
  const { url } = props.element;
  return (
    <SlateElement {...props} as="div">
      <a href={url} rel="noopener noreferrer" style={LINK_STYLE} target="_blank">
        ▶ Video
      </a>
      {props.children}
    </SlateElement>
  );
}

export function AudioElementStatic(props: SlateElementProps<TAudioElement>) {
  const { url } = props.element;
  return (
    <SlateElement {...props} as="div">
      <a href={url} rel="noopener noreferrer" style={LINK_STYLE} target="_blank">
        ♪ Audio
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
      <a href={url} rel="noopener noreferrer" style={LINK_STYLE} target="_blank">
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
        href={url}
        rel="noopener noreferrer"
        style={LINK_STYLE}
        target="_blank"
      >
        📎 {name || 'File'}
      </a>
      {props.children}
    </SlateElement>
  );
}
