'use client';

import { useDraggable } from '@kit/plate/dnd';
import { Image, ImagePlugin, useMediaState } from '@kit/plate/media/react';
import { ResizableProvider, useResizableValue } from '@kit/plate/resizable';
import type { TImageElement } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement, withHOC } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

import { Caption, CaptionTextarea } from './caption';
import { MediaToolbar } from './media-toolbar';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resize-handle';

/**
 * Image with resize handles, caption and floating media toolbar (template
 * media-image-node.tsx port). Email serialization re-emits width/caption as
 * inline styles in media-image-node-static.tsx.
 */
export const ImageElement = withHOC(
  ResizableProvider,
  function ImageElement(props: PlateElementProps<TImageElement>) {
    const { align = 'center', focused, readOnly, selected } = useMediaState();
    const width = useResizableValue('width');

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    return (
      <MediaToolbar plugin={ImagePlugin}>
        <PlateElement {...props} className="py-2.5">
          <figure className="group relative m-0" contentEditable={false}>
            <Resizable
              align={align}
              options={{
                align,
                maxWidth: '100%',
                readOnly,
              }}
            >
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'left' })}
                options={{ direction: 'left' }}
              />
              <div>
                <Image
                  alt={props.attributes.alt as string | undefined}
                  className={cn(
                    'block w-full max-w-full cursor-pointer object-cover px-0',
                    'rounded-sm',
                    focused && selected && 'ring-2 ring-ring ring-offset-2',
                    isDragging && 'opacity-50',
                  )}
                  ref={handleRef}
                />
              </div>
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'right' })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            <Caption align={align} style={{ width }}>
              <CaptionTextarea
                onFocus={(e) => {
                  e.preventDefault();
                }}
                placeholder={__('Write a caption…', 'pressedmail')}
                readOnly={readOnly}
              />
            </Caption>
          </figure>

          {props.children}
        </PlateElement>
      </MediaToolbar>
    );
  },
);
