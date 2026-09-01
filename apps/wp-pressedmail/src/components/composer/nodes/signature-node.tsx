'use client';

import type React from 'react';
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
      <div
        className="pm-signature-label text-xs text-muted-foreground mb-1 select-none"
        data-pm-decoration="true">
        Signature
        {sigElement.accountId != null
          ? ` (Account #${sigElement.accountId})`
          : ''}
      </div>
      {children}
    </PlateElement>
  );
}
