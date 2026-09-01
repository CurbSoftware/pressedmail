import * as React from 'react';
import type { SlateElementProps, SlateLeafProps } from '@kit/plate/static';
import { SlateElement, SlateLeaf } from '@kit/plate/static';

/**
 * Email-safe code block: inline-styled <pre><code> (classes are stripped by
 * the serializer). Long lines wrap, email bodies must never scroll
 * horizontally. Syntax-token leaves serialize as plain children: token
 * colors are hljs classes in the editor and would be stripped anyway.
 */
export function CodeBlockElementStatic(props: SlateElementProps) {
  return (
    <SlateElement {...props}>
      <pre
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '13px',
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
          padding: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <code>{props.children}</code>
      </pre>
    </SlateElement>
  );
}

export function CodeLineElementStatic(props: SlateElementProps) {
  return <SlateElement {...props} />;
}

export function CodeSyntaxLeafStatic(props: SlateLeafProps) {
  return <SlateLeaf {...props}>{props.children}</SlateLeaf>;
}
