'use client';

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
      <span className="pm-attachment-icon">📎</span>
      <span className="pm-attachment-label">
        {a.filename || 'attachment'}
        {a.size ? ` (${a.size})` : ''}
      </span>
      {children}
    </PlateElement>
  );
}
