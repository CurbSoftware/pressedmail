'use client';

import React from 'react';
import { __ } from '@wordpress/i18n';
import { type TElement } from '@kit/plate';
import { PlateElement } from '@kit/plate/react';

import { cn } from '@/lib/utils';

export interface QuoteElement extends TElement {
  type: 'quote';
  collapsed?: boolean;
  sourceFrom?: string | null;
  sourceDate?: string | null;
  sourceMessageId?: string | null;
}

export function QuoteNode({
  attributes,
  children,
  className,
  element,
  ...props
}: React.ComponentProps<typeof PlateElement>) {
  const q = element as QuoteElement;

  // Opening a collapsed quote is a view state, not a document edit: it must not
  // dirty the draft or serialize, so it lives here rather than on the node.
  const [expanded, setExpanded] = React.useState(false);
  const clipped = Boolean(q.collapsed) && !expanded;

  return (
    <PlateElement
      attributes={attributes}
      className={cn(
        'pm-quote-block border-l-2 border-muted pl-4 my-3 text-muted-foreground',
        q.collapsed && 'pm-quote-collapsed',
        className,
      )}
      element={element}
      {...props}
    >
      {q.sourceFrom && (
        <div
          className="pm-quote-header text-xs text-muted-foreground/70 mb-1 select-none"
          data-pm-decoration="true">
          {q.sourceFrom}
          {q.sourceDate && ` - ${q.sourceDate}`}
        </div>
      )}
      <div className={cn('pm-quote-content', clipped && 'max-h-24 overflow-hidden')}>
        {children}
      </div>
      {clipped && (
        // Without this the quoted message was simply gone: clipped to about
        // four lines with nothing to open it, in an editor where the rest of it
        // was still there and still sent. contentEditable=false keeps the
        // caret out of it, and data-pm-decoration is what strips it before the
        // message goes out.
        <button
          type="button"
          contentEditable={false}
          data-pm-decoration="true"
          data-test="quote-expand"
          data-testid="quote-expand"
          className="pm-quote-expand mt-1 select-none rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
          // mousedown, not click: the editor would move the caret and tear
          // down the button before a click ever landed.
          onMouseDown={(event) => {
            event.preventDefault();
            setExpanded(true);
          }}>
          {__('Show trimmed content', 'pressedmail')}
        </button>
      )}
    </PlateElement>
  );
}
