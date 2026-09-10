'use client';

import type React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { type TElement } from '@kit/plate';
import { PlateElement } from '@kit/plate/react';

import { cn } from '@/lib/utils';

export interface SignatureElement extends TElement {
  type: 'signature';
  accountId?: number | null;
  signatureId?: number | null;
}

export function SignatureNode({
  attributes,
  children,
  className,
  element,
  ...props
}: React.ComponentProps<typeof PlateElement>) {
  const sigElement = element as SignatureElement;

  return (
    <PlateElement
      attributes={attributes}
      className={cn(
        'pm-signature-block border-l-2 border-pro/30 pl-4 my-4',
        className,
      )}
      element={element}
      {...props}
    >
      {/*
        contentEditable={false} is load-bearing, not cosmetic: without it the
        browser puts the caret inside this label, Slate cannot resolve a point
        from a DOM node it does not own, and whatever gets typed is wiped on the
        next render.
      */}
      <div
        className="pm-signature-label text-xs text-muted-foreground mb-1 select-none"
        contentEditable={false}
        data-pm-decoration="true">
        {sigElement.accountId != null
          ? sprintf(
              /* translators: %d: email account number. */
              __( 'Signature (Account #%d)', 'pressedmail' ),
              sigElement.accountId,
            )
          : __( 'Signature', 'pressedmail' )}
      </div>
      {children}
    </PlateElement>
  );
}
