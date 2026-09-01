'use client';

import { useMemo } from 'react';

import { cn } from '#utils';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { generateHTML } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';

import type { JSONContent } from './rich-text-editor';

const lowlight = createLowlight(common);

const extensions = [
  StarterKit.configure({
    codeBlock: false,
    heading: {
      levels: [1, 2, 3],
    },
  }),
  CodeBlockLowlight.configure({
    lowlight,
  }),
  Image.configure({
    HTMLAttributes: {
      class: 'rounded-lg max-w-full',
    },
  }),
  Link.configure({
    openOnClick: true,
    HTMLAttributes: {
      class: 'text-primary underline',
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
];

export interface RichTextRendererProps {
  content: JSONContent;
  className?: string;
}

export function RichTextRenderer({
  content,
  className,
}: RichTextRendererProps) {
  const html = useMemo(() => {
    if (!content || !content.type) {
      return '';
    }
    try {
      return generateHTML(content, extensions);
    } catch {
      return '';
    }
  }, [content]);

  if (!html) {
    return null;
  }

  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        'prose-headings:font-semibold',
        'prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
        'prose-p:my-3',
        'prose-ul:my-3 prose-ol:my-3',
        'prose-li:my-1',
        'prose-blockquote:border-l-4 prose-blockquote:border-muted prose-blockquote:pl-4 prose-blockquote:italic',
        'prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-sm',
        'prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg',
        'prose-img:rounded-lg',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function renderRichTextToHtml(content: JSONContent): string {
  if (!content || !content.type) {
    return '';
  }
  try {
    return generateHTML(content, extensions);
  } catch {
    return '';
  }
}
