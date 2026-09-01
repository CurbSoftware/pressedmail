import * as React from 'react';
import type { SlateLeafProps } from '@kit/plate/static';
import { SlateLeaf } from '@kit/plate/static';

/**
 * Email-safe <kbd>: serializeHtml strips classes, so the key-cap look is
 * inline styles only (concrete colors are intentional, email clients
 * cannot resolve theme tokens).
 */
export function KbdLeafStatic(props: SlateLeafProps) {
  return (
    <SlateLeaf
      {...props}
      as="kbd"
      style={{
        backgroundColor: '#f4f4f5',
        border: '1px solid #e4e4e7',
        borderRadius: '4px',
        color: '#18181b',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '0.875em',
        padding: '1px 6px',
      }}
    >
      {props.children}
    </SlateLeaf>
  );
}
