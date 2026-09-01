'use client';

import { useEffect, useRef } from 'react';

import { cn } from '#utils';

interface CodeBlockCopyProps {
  /** Direct children to render */
  children?: React.ReactNode;
  /** Pre-sanitized HTML content to render (from trusted sources like CMS) */
  content?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show copy button only on hover (default: false) */
  showOnHover?: boolean;
  /** Whether to add prose styling (default: false) */
  prose?: boolean;
}

/**
 * Wrapper component that adds copy-to-clipboard buttons to all code blocks.
 * Supports two modes:
 * - children: Renders React children directly (for React-based content)
 * - content: Renders pre-sanitized HTML from trusted sources (CMS/pre-rendered)
 *
 * SECURITY NOTE: The `content` prop should only be used with pre-sanitized HTML
 * from trusted sources (e.g., Keystatic CMS output). Never pass user-generated
 * content directly to this prop.
 */
export function CodeBlockCopy({
  children,
  content,
  className,
  showOnHover = false,
  prose = false,
}: CodeBlockCopyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const codeBlocks = container.querySelectorAll('pre');

    codeBlocks.forEach((pre) => {
      // Skip if already has a copy button
      if (pre.querySelector('.code-copy-btn')) return;

      // Make pre relative for positioning
      pre.style.position = 'relative';

      // Create copy button
      const button = document.createElement('button');
      button.className = cn(
        'code-copy-btn bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground absolute top-2 right-2 rounded-md p-1.5 transition-colors',
        showOnHover && 'opacity-0 group-hover:opacity-100',
      );
      button.setAttribute('aria-label', 'Copy code');
      button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

      // Make pre a group for hover effect
      if (showOnHover) {
        pre.classList.add('group');
      }

      // Add click handler
      button.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const text = code?.textContent ?? pre.textContent ?? '';

        try {
          await navigator.clipboard.writeText(text);
          button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-success"><path d="M20 6 9 17l-5-5"/></svg>`;

          setTimeout(() => {
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
          }, 2000);
        } catch {
          console.error('Failed to copy code');
        }
      });

      pre.appendChild(button);
    });

    // Cleanup
    return () => {
      codeBlocks.forEach((pre) => {
        const btn = pre.querySelector('.code-copy-btn');
        btn?.remove();
      });
    };
  }, [children, content, showOnHover]);

  const containerClassName = cn(
    'markdoc',
    prose && 'prose prose-sm dark:prose-invert max-w-none',
    className,
  );

  // If content is provided, render pre-sanitized HTML from trusted source
  // This is safe because content comes from CMS/server rendering, not user input
  if (content) {
    return (
      <div
        ref={containerRef}
        className={containerClassName}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Otherwise render children directly
  return (
    <div ref={containerRef} className={containerClassName}>
      {children}
    </div>
  );
}
