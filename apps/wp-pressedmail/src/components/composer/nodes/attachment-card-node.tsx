'use client';

import { __ } from '@wordpress/i18n';
import { Paperclip } from 'lucide-react';
import type React from 'react';
import { type TElement } from '@kit/plate';
import { PlateElement } from '@kit/plate/react';

import { cn } from '@/lib/utils';

export interface AttachmentCardElement extends TElement {
  type: 'attachment';
  filename?: string;
  size?: string;
  id?: string;
}

export function AttachmentCardNode({
  attributes,
  children,
  className,
  element,
  ...props
}: React.ComponentProps<typeof PlateElement>) {
  const a = element as AttachmentCardElement;

  return (
    <PlateElement
      attributes={attributes}
      className={cn(
        'pm-attachment-chip inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-muted bg-muted/30 text-sm select-none',
        className,
      )}
      element={element}
      {...props}
    >
      <Paperclip aria-hidden="true" className="pm-attachment-icon size-3.5" />
      <span className="pm-attachment-label">
        {a.filename || __('Attachment', 'pressedmail')}
        {a.size ? ` (${a.size})` : ''}
      </span>
      {children}
    </PlateElement>
  );
}
