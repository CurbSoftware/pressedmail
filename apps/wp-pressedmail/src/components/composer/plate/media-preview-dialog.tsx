'use client';

import { __ } from '@wordpress/i18n';

import type * as React from 'react';
import {
  PreviewImage,
  useImagePreview,
  useImagePreviewValue,
  useScaleInput,
} from '@kit/plate/media/react';
import { cva } from 'class-variance-authority';
import { ArrowLeft, ArrowRight, Download, Minus, Plus, X } from 'lucide-react';
import { useEditorRef } from '@kit/plate/react';

import { cn } from '@/lib/utils';

import { safeMediaUrl } from './safe-media-url';

/**
 * Full-screen image preview with zoom/navigation/download (template port).
 * The overlay is intentionally a fixed dark scrim (same in light/dark).
 */
const buttonVariants = cva('rounded bg-black/50 px-1', {
  defaultVariants: {
    variant: 'default',
  },
  variants: {
    variant: {
      default: 'text-white',
      disabled: 'cursor-not-allowed text-white/40',
    },
  },
});

const SCROLL_SPEED = 4;
const DEFAULT_DOWNLOAD_FILENAME = 'image';

export function MediaPreviewDialog() {
  const editor = useEditorRef();
  const isOpen = useImagePreviewValue('isOpen', editor.id);
  const scale = useImagePreviewValue('scale');
  const isEditingScale = useImagePreviewValue('isEditingScale');
  const currentPreview = useImagePreviewValue('currentPreview');
  const {
    closeProps,
    currentUrlIndex,
    maskLayerProps,
    nextDisabled,
    nextProps,
    prevDisabled,
    prevProps,
    scaleTextProps,
    zommOutProps,
    zoomInDisabled,
    zoomInProps,
    zoomOutDisabled,
  } = useImagePreview({ scrollSpeed: SCROLL_SPEED });
  const downloadUrl = safeMediaUrl(currentPreview?.url);
  const downloadDisabled = !downloadUrl;
  const handleDownload = () => {
    if (!downloadUrl) return;

    const link = document.createElement('a');
    link.download = getImageDownloadFilename(downloadUrl);
    link.href = downloadUrl;
    link.rel = 'noopener noreferrer';
    document.body.append(link);
    link.click();
    link.remove();
  };

  return (
    <div
      className={cn(
        'fixed left-0 top-0 z-50 h-screen w-screen select-none',
        !isOpen && 'hidden',
      )}
      onContextMenu={(e) => e.stopPropagation()}
      {...maskLayerProps}
    >
      <div className="absolute inset-0 size-full bg-black opacity-30" />
      <div className="absolute inset-0 size-full bg-black opacity-30" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex max-h-screen w-full items-center">
          <PreviewImage
            className={cn(
              'mx-auto block max-h-[calc(100vh-4rem)] w-auto object-contain transition-transform',
            )}
          />
          <div
            className="absolute bottom-0 left-1/2 z-40 flex w-fit -translate-x-1/2 justify-center gap-4 p-2 text-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1">
              <button
                {...prevProps}
                aria-label={__('Previous image', 'pressedmail')}
                className={cn(
                  buttonVariants({
                    variant: prevDisabled ? 'disabled' : 'default',
                  }),
                )}
                type="button"
              >
                <ArrowLeft />
              </button>
              {(currentUrlIndex ?? 0) + 1}
              <button
                {...nextProps}
                aria-label={__('Next image', 'pressedmail')}
                className={cn(
                  buttonVariants({
                    variant: nextDisabled ? 'disabled' : 'default',
                  }),
                )}
                type="button"
              >
                <ArrowRight />
              </button>
            </div>
            <div className="flex">
              <button
                className={cn(
                  buttonVariants({
                    variant: zoomOutDisabled ? 'disabled' : 'default',
                  }),
                )}
                {...zommOutProps}
                aria-label={__('Zoom out', 'pressedmail')}
                type="button"
              >
                <Minus className="size-4" />
              </button>
              <div className="mx-px">
                {isEditingScale ? (
                  <>
                    <ScaleInput
                      aria-label={__('Zoom level', 'pressedmail')}
                      className="w-10 rounded bg-transparent px-1 text-white outline outline-1 outline-white/60"
                    />{' '}
                    <span>%</span>
                  </>
                ) : (
                  <span {...scaleTextProps}>{`${scale * 100}%`}</span>
                )}
              </div>
              <button
                className={cn(
                  buttonVariants({
                    variant: zoomInDisabled ? 'disabled' : 'default',
                  }),
                )}
                {...zoomInProps}
                aria-label={__('Zoom in', 'pressedmail')}
                type="button"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <button
              className={cn(
                buttonVariants({
                  variant: downloadDisabled ? 'disabled' : 'default',
                }),
              )}
              aria-label={__('Download image', 'pressedmail')}
              disabled={downloadDisabled}
              onClick={handleDownload}
              type="button"
            >
              <Download className="size-4" />
            </button>
            <button
              {...closeProps}
              aria-label={__('Close preview', 'pressedmail')}
              className={cn(buttonVariants())}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScaleInput(props: React.ComponentProps<'input'>) {
  const { props: scaleInputProps, ref } = useScaleInput();

  return <input autoComplete="off" {...scaleInputProps} {...props} ref={ref} />;
}

function getImageDownloadFilename(url: string) {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();

    return filename || DEFAULT_DOWNLOAD_FILENAME;
  } catch {
    return DEFAULT_DOWNLOAD_FILENAME;
  }
}
