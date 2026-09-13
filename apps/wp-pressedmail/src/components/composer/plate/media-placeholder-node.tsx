'use client';

import * as React from 'react';
import {
  PlaceholderPlugin,
  PlaceholderProvider,
  updateUploadHistory,
} from '@kit/plate/media/react';
import { AudioLines, FileUp, Film, ImageIcon, Loader2Icon } from 'lucide-react';
import type { TPlaceholderElement } from '@kit/plate';
import { KEYS } from '@kit/plate';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement, useEditorPlugin, withHOC } from '@kit/plate/react';
import { useFilePicker } from 'use-file-picker';
import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

import { useComposerUploadFile } from './use-composer-upload-file';

/**
 * Upload placeholder with progress (template media-placeholder-node.tsx
 * port over the PressedMail upload bridge). Failed/unsupported uploads
 * remove the placeholder so drafts never carry transient nodes.
 *
 * Built on call: the locale catalog loads after this module is imported, so
 * a module-level __() would always return English.
 */
const getContent = (): Record<
  string,
  {
    accept: string[];
    content: string;
    icon: React.ReactNode;
  }
> => ({
  [KEYS.audio]: {
    accept: ['audio/*'],
    content: __('Add an audio file', 'pressedmail'),
    icon: <AudioLines />,
  },
  [KEYS.file]: {
    accept: ['*'],
    content: __('Add a file', 'pressedmail'),
    icon: <FileUp />,
  },
  [KEYS.img]: {
    accept: ['image/*'],
    content: __('Add an image', 'pressedmail'),
    icon: <ImageIcon />,
  },
  [KEYS.video]: {
    accept: ['video/*'],
    content: __('Add a video', 'pressedmail'),
    icon: <Film />,
  },
});

export const PlaceholderElement = withHOC(
  PlaceholderProvider,
  function PlaceholderElement(props: PlateElementProps<TPlaceholderElement>) {
    const { editor, element } = props;

    const { api } = useEditorPlugin(PlaceholderPlugin);

    const {
      isUploading,
      progress,
      uploadedFile,
      uploadError,
      uploadFile,
      uploadingFile,
    } = useComposerUploadFile();

    const loading = isUploading && uploadingFile;

    const currentContent = getContent()[element.mediaType];

    const isImage = element.mediaType === KEYS.img;

    const imageRef = React.useRef<HTMLImageElement>(null);

    const { openFilePicker } = useFilePicker({
      accept: currentContent?.accept ?? ['*'],
      multiple: true,
      onFilesSelected: ({ plainFiles: updatedFiles }: { plainFiles: File[] }) => {
        const firstFile = updatedFiles[0];
        const restFiles = updatedFiles.slice(1);

        if (firstFile) replaceCurrentPlaceholder(firstFile);

        if (restFiles.length > 0) {
          const dataTransfer = new DataTransfer();
          for (const file of restFiles) dataTransfer.items.add(file);
          editor
            .getTransforms(PlaceholderPlugin)
            .insert.media(dataTransfer.files);
        }
      },
    });

    const replaceCurrentPlaceholder = React.useCallback(
      (file: File) => {
        void uploadFile(file);
        api.placeholder.addUploadingFile(element.id as string, file);
      },
      [api.placeholder, element.id, uploadFile],
    );

    React.useEffect(() => {
      if (!uploadedFile) return;

      const path = editor.api.findPath(element);

      editor.tf.withoutSaving(() => {
        editor.tf.removeNodes({ at: path });

        const node = {
          children: [{ text: '' }],
          initialHeight: imageRef.current?.height,
          initialWidth: imageRef.current?.width,
          isUpload: true,
          name: element.mediaType === KEYS.file ? uploadedFile.name : '',
          placeholderId: element.id as string,
          type: element.mediaType!,
          url: uploadedFile.url,
        };

        editor.tf.insertNodes(node, { at: path });

        updateUploadHistory(editor, node);
      });

      api.placeholder.removeUploadingFile(element.id as string);

    }, [uploadedFile, element.id]);

    // Drop the placeholder when the upload fails or is unsupported.
    React.useEffect(() => {
      if (!uploadError) return;

      const path = editor.api.findPath(element);
      editor.tf.withoutSaving(() => {
        editor.tf.removeNodes({ at: path });
      });
      api.placeholder.removeUploadingFile(element.id as string);

    }, [uploadError]);

    // React dev mode will call React.useEffect twice
    const isReplaced = React.useRef(false);

    /** Paste and drop */
    React.useEffect(() => {
      if (isReplaced.current) return;

      isReplaced.current = true;
      const currentFiles = api.placeholder.getUploadingFile(
        element.id as string,
      );

      if (!currentFiles) return;

      replaceCurrentPlaceholder(currentFiles);

    }, [isReplaced]);

    return (
      <PlateElement className="my-1" {...props}>
        {(!loading || !isImage) && (
          <div
            className={cn(
              'flex cursor-pointer select-none items-center rounded-sm bg-muted p-3 pr-9 hover:bg-primary/10',
            )}
            contentEditable={false}
            onClick={() => !loading && openFilePicker()}
          >
            <div className="relative mr-3 flex text-muted-foreground/80 [&_svg]:size-6">
              {currentContent?.icon}
            </div>
            <div className="whitespace-nowrap text-sm text-muted-foreground">
              <div>
                {loading ? uploadingFile?.name : currentContent?.content}
              </div>

              {loading && !isImage && (
                <div className="mt-1 flex items-center gap-1.5">
                  <div>{formatBytes(uploadingFile?.size ?? 0)}</div>
                  <div>-</div>
                  <div className="flex items-center">
                    <Loader2Icon className="mr-1 size-3.5 animate-spin text-muted-foreground" />
                    {progress ?? 0}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isImage && loading && (
          <ImageProgress
            file={uploadingFile}
            imageRef={imageRef}
            progress={progress}
          />
        )}

        {props.children}
      </PlateElement>
    );
  },
);

export function ImageProgress({
  className,
  file,
  imageRef,
  progress = 0,
}: {
  file: File;
  className?: string;
  imageRef?: React.RefObject<HTMLImageElement | null>;
  progress?: number;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!objectUrl) {
    return null;
  }

  return (
    <div className={cn('relative', className)} contentEditable={false}>
      <img
        alt={file.name}
        className="h-auto w-full rounded-sm object-cover"
        ref={imageRef}
        src={objectUrl}
      />
      {progress < 100 && (
        <div className="absolute bottom-1 right-1 flex items-center space-x-2 rounded-full bg-black/50 px-1 py-0.5">
          <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs font-medium text-white">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

function formatBytes(
  bytes: number,
  opts: {
    decimals?: number;
    sizeType?: 'accurate' | 'normal';
  } = {},
) {
  const { decimals = 0, sizeType = 'normal' } = opts;

  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const accurateSizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB'];

  if (bytes === 0) return '0 Byte';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / 1024 ** i).toFixed(decimals)} ${
    sizeType === 'accurate'
      ? (accurateSizes[i] ?? 'Bytes')
      : (sizes[i] ?? 'Bytes')
  }`;
}
