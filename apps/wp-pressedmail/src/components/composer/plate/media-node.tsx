'use client';

import { useDraggable } from '@kit/plate/dnd';
import { parseVideoUrl } from '@kit/plate/media';
import { useMediaState, VideoPlugin } from '@kit/plate/media/react';
import { ResizableProvider, useResizableValue } from '@kit/plate/resizable';
import { FileUp } from 'lucide-react';
import type {
  TAudioElement,
  TFileElement,
  TResizableProps,
  TVideoElement,
} from '@kit/plate';
import { KEYS } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement, useReadOnly, withHOC } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

import { Caption, CaptionTextarea } from './caption';
import { MediaUrlInput } from './media-url-input';
import { MediaToolbar } from './media-toolbar';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resize-handle';

/**
 * Interactive media nodes with caption + resize + floating toolbar (template
 * ports, minus react-player/react-lite-youtube-embed, embed URLs render via
 * a plain <iframe>, uploads via native <video>). Email serialization
 * downgrades all of these to links (media-node-static.tsx) since clients
 * can't play inline media.
 */
export const VideoElement = withHOC(
  ResizableProvider,
  function VideoElement(
    props: PlateElementProps<TVideoElement & TResizableProps>,
  ) {
    const {
      align = 'center',
      embed,
      isUpload,
      isVideo,
      readOnly,
      unsafeUrl,
    } = useMediaState({
      urlParsers: [parseVideoUrl],
    });
    const width = useResizableValue('width');
    const showEmbedFrame = !isUpload && isVideo && embed?.url;

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    // Empty node → styled URL input. Media is added by URL (embed), not upload.
    if (!props.element.url) {
      return (
        <PlateElement className="my-1" {...props}>
          <MediaUrlInput
            editor={props.editor}
            element={props.element}
            mediaType={KEYS.video}
          />
          {props.children}
        </PlateElement>
      );
    }

    return (
      <MediaToolbar plugin={VideoPlugin}>
        <PlateElement className="py-2.5" {...props}>
          <figure
            className="relative m-0 cursor-default"
            contentEditable={false}
          >
            <Resizable
              align={align}
              className={cn(isDragging && 'opacity-50')}
              options={{
                align,
                maxWidth: '100%',
                minWidth: 100,
                readOnly,
              }}
            >
              <div className="group/media">
                <ResizeHandle
                  className={mediaResizeHandleVariants({ direction: 'left' })}
                  options={{ direction: 'left' }}
                />

                <ResizeHandle
                  className={mediaResizeHandleVariants({ direction: 'right' })}
                  options={{ direction: 'right' }}
                />

                {showEmbedFrame ? (
                  <div className="relative pb-[56.25%]" ref={handleRef}>
                    <iframe
                      allowFullScreen
                      className="absolute left-0 top-0 size-full rounded-sm border-0"
                      src={embed.url}
                      title="video"
                    />
                  </div>
                ) : (
                  <div ref={handleRef}>
                    <video
                      className="w-full max-w-full rounded-sm object-cover px-0"
                      controls
                      src={unsafeUrl}
                    />
                  </div>
                )}
              </div>
            </Resizable>

            <Caption align={align} style={{ width }}>
              <CaptionTextarea
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

export const AudioElement = withHOC(
  ResizableProvider,
  function AudioElement(props: PlateElementProps<TAudioElement>) {
    const { align = 'center', readOnly, unsafeUrl } = useMediaState();

    if (!props.element.url) {
      return (
        <PlateElement {...props} className="mb-1">
          <MediaUrlInput
            editor={props.editor}
            element={props.element}
            mediaType={KEYS.audio}
          />
          {props.children}
        </PlateElement>
      );
    }

    return (
      <PlateElement {...props} className="mb-1">
        <figure
          className="group relative cursor-default"
          contentEditable={false}
        >
          <div className="h-16 rounded-sm">
            <audio className="size-full" controls src={unsafeUrl} />
          </div>

          <Caption align={align} style={{ width: '100%' }}>
            <CaptionTextarea
              className="h-20"
              placeholder={__('Write a caption…', 'pressedmail')}
              readOnly={readOnly}
            />
          </Caption>
        </figure>
        {props.children}
      </PlateElement>
    );
  },
);

export const FileElement = withHOC(
  ResizableProvider,
  function FileElement(props: PlateElementProps<TFileElement>) {
    const readOnly = useReadOnly();
    const { name, unsafeUrl } = useMediaState();

    if (!props.element.url) {
      return (
        <PlateElement className="my-px rounded-sm" {...props}>
          <MediaUrlInput
            editor={props.editor}
            element={props.element}
            mediaType={KEYS.file}
          />
          {props.children}
        </PlateElement>
      );
    }

    return (
      <PlateElement className="my-px rounded-sm" {...props}>
        <a
          className={cn(
            'group relative m-0 flex cursor-pointer items-center rounded px-0.5 py-[3px] hover:bg-muted',
          )}
          contentEditable={false}
          download={name}
          href={unsafeUrl}
          rel="noopener noreferrer"
          role="button"
          target="_blank"
        >
          <div className="flex items-center gap-1 p-1">
            <FileUp className="size-5" />
            <div>{name}</div>
          </div>

          <Caption align="left">
            <CaptionTextarea
              className="text-left"
              placeholder={__('Write a caption…', 'pressedmail')}
              readOnly={readOnly}
            />
          </Caption>
        </a>
        {props.children}
      </PlateElement>
    );
  },
);
