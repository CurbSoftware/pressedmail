import * as React from 'react';
import { NodeApi } from '@kit/plate';
import type { TCaptionProps, TImageElement, TResizableProps } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe image: inline styles only (classes are stripped). Resize width
 * is emitted as an inline width with max-width:100%, captions become a
 * <figcaption>.
 */
export function ImageElementStatic(
  props: SlateElementProps<TImageElement & TCaptionProps & TResizableProps>,
) {
  const { align = 'center', caption, url, width } = props.element;
  const captionText = caption?.[0] ? NodeApi.string(caption[0]) : '';
  const widthStyle =
    typeof width === 'number' ? `${width}px` : (width as string | undefined);

  return (
    <SlateElement {...props}>
      <figure
        style={{
          margin: '10px 0',
          textAlign: align as React.CSSProperties['textAlign'],
        }}
      >
        <img
          alt={(props.attributes as { alt?: string }).alt ?? ''}
          src={url}
          style={{
            borderRadius: '4px',
            height: 'auto',
            maxWidth: '100%',
            ...(widthStyle ? { width: widthStyle } : {}),
          }}
        />
        {captionText && (
          <figcaption
            style={{
              color: '#6b7280',
              fontSize: '12px',
              marginTop: '4px',
              textAlign: 'center',
            }}
          >
            {captionText}
          </figcaption>
        )}
      </figure>
      {props.children}
    </SlateElement>
  );
}
