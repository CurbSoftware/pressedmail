'use client';

/**
 * Media toolbar split button (template media-toolbar-button.tsx port):
 * primary click opens the file picker (routed through the composer upload
 * placeholder flow → WP upload endpoint); the dropdown offers upload /
 * insert-via-URL. `MediaUrlDialog` is exported for reuse by the fixed
 * toolbar's merged Image dropdown.
 */

import * as React from 'react';
import { PlaceholderPlugin } from '@kit/plate/media/react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  AudioLinesIcon,
  FileUpIcon,
  FilmIcon,
  ImageIcon,
  LinkIcon,
} from 'lucide-react';
import { isUrl, KEYS } from '@kit/plate';
import { useEditorRef } from '@kit/plate/react';
import { useFilePicker } from 'use-file-picker';

import { __ } from '@wordpress/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@kit/ui/plugin';

import { appMessage } from '@/context/toast';
import {
  ToolbarSplitButton,
  ToolbarSplitButtonPrimary,
  ToolbarSplitButtonSecondary,
} from '@/components/composer/toolbar';

function isSafeImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    return !parsed.pathname.toLowerCase().endsWith('.svg');
  } catch {
    return false;
  }
}

interface MediaConfig {
  accept: string[];
  icon: React.ReactNode;
  title: string;
  tooltip: string;
}

// Built on call: a module-level __() runs before main.tsx loads the locale
// catalog, so these titles would always be English.
function getMediaConfig(nodeType: string): MediaConfig {
  switch (nodeType) {
    case KEYS.audio:
      return {
        accept: ['audio/*'],
        icon: <AudioLinesIcon className="size-4" />,
        title: __('Insert audio', 'pressedmail'),
        tooltip: __('Audio', 'pressedmail'),
      };
    case KEYS.img:
      return {
        accept: ['image/*'],
        icon: <ImageIcon className="size-4" />,
        title: __('Insert image', 'pressedmail'),
        tooltip: __('Image', 'pressedmail'),
      };
    case KEYS.video:
      return {
        accept: ['video/*'],
        icon: <FilmIcon className="size-4" />,
        title: __('Insert video', 'pressedmail'),
        tooltip: __('Video', 'pressedmail'),
      };
    default:
      return {
        accept: ['*'],
        icon: <FileUpIcon className="size-4" />,
        title: __('Insert file', 'pressedmail'),
        tooltip: __('File', 'pressedmail'),
      };
  }
}

export function MediaToolbarButton({
  nodeType,
  ...props
}: DropdownMenuProps & { nodeType: string }) {
  const currentConfig = getMediaConfig(nodeType);

  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const { openFilePicker } = useFilePicker({
    accept: currentConfig.accept,
    multiple: true,
    onFilesSelected: ({ plainFiles: updatedFiles }: { plainFiles: File[] }) => {
      // insert.media expects a FileList; use-file-picker hands back File[].
      const dataTransfer = new DataTransfer();
      for (const file of updatedFiles) {
        dataTransfer.items.add(file);
      }
      editor.getTransforms(PlaceholderPlugin).insert.media(dataTransfer.files);
    },
  });

  return (
    <>
      <ToolbarSplitButton
        onClick={() => {
          openFilePicker();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        pressed={open}
        tooltip={currentConfig.tooltip}
      >
        <ToolbarSplitButtonPrimary>
          {currentConfig.icon}
        </ToolbarSplitButtonPrimary>

        <DropdownMenu
          modal={false}
          onOpenChange={setOpen}
          open={open}
          {...props}
        >
          <DropdownMenuTrigger asChild>
            <ToolbarSplitButtonSecondary />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            alignOffset={-32}
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openFilePicker()}>
                {currentConfig.icon}
                {__('Upload from computer', 'pressedmail')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
                <LinkIcon />
                {__('Insert via URL', 'pressedmail')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarSplitButton>

      <MediaUrlDialog
        nodeType={nodeType}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </>
  );
}

/**
 * "Insert via URL" dialog for any media node type. Shared between
 * MediaToolbarButton and the fixed toolbar's merged Image dropdown.
 */
export function MediaUrlDialog({
  nodeType,
  open,
  onOpenChange,
}: {
  nodeType: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const currentConfig = getMediaConfig(nodeType);

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent className="gap-6">
        <MediaUrlDialogContent
          currentConfig={currentConfig}
          nodeType={nodeType}
          setOpen={onOpenChange}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MediaUrlDialogContent({
  currentConfig,
  nodeType,
  setOpen,
}: {
  currentConfig: MediaConfig;
  nodeType: string;
  setOpen: (value: boolean) => void;
}) {
  const editor = useEditorRef();
  const [url, setUrl] = React.useState('');

  const embedMedia = React.useCallback(() => {
    if (!isUrl(url)) {
      appMessage(__('Invalid URL', 'pressedmail'), 'error');
      return;
    }

    if (nodeType === KEYS.img && !isSafeImageUrl(url)) {
      appMessage(
        __('Use a safe http or https image URL. SVG images are not allowed.', 'pressedmail'),
        'error',
      );
      return;
    }

    setOpen(false);
    editor.tf.insertNodes({
      children: [{ text: '' }],
      name: nodeType === KEYS.file ? url.split('/').pop() : undefined,
      type: nodeType,
      url,
    });
    editor.tf.focus();
  }, [url, editor, nodeType, setOpen]);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>
          <AlertDialogTitleRow>
            <LinkIcon />
            <span>{currentConfig?.title}</span>
          </AlertDialogTitleRow>
        </AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription asChild>
        <div className="w-full space-y-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="composer-media-url"
          >
            {__('URL', 'pressedmail')}
          </label>
          <Input autoComplete="off"
            autoFocus
            className="w-full"
            id="composer-media-url"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') embedMedia();
            }}
            placeholder="https://"
            type="url"
            value={url}
          />
        </div>
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel>{__('Cancel', 'pressedmail')}</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            embedMedia();
          }}
        >
          {__('Insert', 'pressedmail')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
