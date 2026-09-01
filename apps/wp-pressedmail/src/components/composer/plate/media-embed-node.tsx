'use client';

import { parseVideoUrl } from '@kit/plate/media';
import { MediaEmbedPlugin, useMediaState } from '@kit/plate/media/react';
import { ResizableProvider, useResizableValue } from '@kit/plate/resizable';
import { Link2 } from 'lucide-react';
import type { TMediaEmbedElement } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement, withHOC } from '@kit/plate/react';

import { cn } from '@/lib/utils';

import { Caption, CaptionTextarea } from './caption';
import { MediaToolbar } from './media-toolbar';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from './resize-handle';

/**
 * Embed node, simplified from the template: video providers render a plain
 * <iframe> (no react-lite-youtube-embed/react-tweet/react-player deps,
 * three heavy libraries for an email composer); anything else renders a link
 * card. Email serialization downgrades every embed to an anchor.
 */
export const MediaEmbedElement = withHOC(
  ResizableProvider,
  function MediaEmbedElement(props: PlateElementProps<TMediaEmbedElement>) {
    const {
      align = 'center',
      embed,
      focused,
      isVideo,
      readOnly,
      selected,
    } = useMediaState({
      urlParsers: [parseVideoUrl],
    });
    const width = useResizableValue('width');
    const url = props.element.url;

    return (
      <MediaToolbar plugin={MediaEmbedPlugin}>
        <PlateElement className="py-2.5" {...props}>
          <figure
            className="group relative m-0 w-full cursor-default"
            contentEditable={false}
          >
            <Resizable
              align={align}
              options={{
                align,
                maxWidth: '100%',
                minWidth: 100,
                readOnly,
              }}
            >
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'left' })}
                options={{ direction: 'left' }}
              />

              {isVideo && embed?.url ? (
                <div className="relative pb-[56.25%]">
                  <iframe
                    allowFullScreen
                    className={cn(
                      'absolute left-0 top-0 size-full rounded-sm border-0',
                      focused && selected && 'ring-2 ring-ring ring-offset-2',
                    )}
                    src={embed.url}
                    title="embed"
                  />
                </div>
              ) : (
                <a
                  className={cn(
                    'flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-primary underline underline-offset-2 hover:bg-muted',
                    focused && selected && 'ring-2 ring-ring ring-offset-2',
                  )}
                  href={url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{url}</span>
                </a>
              )}

              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'right' })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            <Caption align={align} style={{ width }}>
              <CaptionTextarea placeholder="Write a caption…" />
            </Caption>
          </figure>

          {props.children}
        </PlateElement>
      </MediaToolbar>
    );
  },
);
