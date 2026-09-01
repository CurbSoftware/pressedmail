'use client';

import * as React from 'react';
import { AudioLines, FileUp, Film, Link2 } from 'lucide-react';
import { KEYS } from '@kit/plate';
import type { TElement } from '@kit/plate';
import type { PlateEditor } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { cn } from '@/lib/utils';

/**
 * Inline URL input shown by an empty media node (video/audio/file). PressedMail
 * composer media is added by URL, pasting a link EMBEDS it (VideoElement renders
 * an <iframe> for video providers, a <video>/<audio> for direct media URLs, a
 * download link for files; email serialization downgrades all to links). There
 * is no upload flow for these nodes, so the node renders this styled input until
 * a URL is supplied, then re-renders as the embed.
 */
function mediaMeta(mediaType: string): { icon: React.ReactNode; label: string } {
  switch (mediaType) {
    case KEYS.video:
      return { icon: <Film />, label: __('Paste a video URL to embed', 'pressedmail') };
    case KEYS.audio:
      return { icon: <AudioLines />, label: __('Paste an audio URL', 'pressedmail') };
    case KEYS.file:
      return { icon: <FileUp />, label: __('Paste a file URL', 'pressedmail') };
    default:
      return { icon: <Link2 />, label: __('Paste a URL', 'pressedmail') };
  }
}

export function MediaUrlInput({
  editor,
  element,
  mediaType,
}: {
  editor: PlateEditor;
  element: TElement;
  mediaType: string;
}) {
  const [value, setValue] = React.useState('');
  const meta = mediaMeta(mediaType);

  const embed = React.useCallback(() => {
    const url = value.trim();
    if (!url) return;
    const path = editor.api.findPath(element);
    if (!path) return;
    editor.tf.setNodes({ url }, { at: path });
    editor.tf.focus();
  }, [editor, element, value]);

  return (
    <div
      className={cn(
        'my-1 flex items-center gap-2 rounded-sm bg-muted p-3',
      )}
      contentEditable={false}
    >
      <span className="flex text-muted-foreground/80 [&_svg]:size-5">
        {meta.icon}
      </span>
      <input autoComplete="off"
        autoFocus
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            embed();
          }
        }}
        placeholder={meta.label}
        type="url"
        value={value}
      />
      <button
        className="rounded-sm bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        disabled={!value.trim()}
        onClick={embed}
        type="button"
      >
        {__('Embed', 'pressedmail')}
      </button>
    </div>
  );
}
