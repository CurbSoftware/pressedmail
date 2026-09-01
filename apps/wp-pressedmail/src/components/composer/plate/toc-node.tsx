'use client';

import { useTocElement, useTocElementState } from '@kit/plate/toc/react';
import { cva } from 'class-variance-authority';
import type { PlateElementProps } from '@kit/plate/react';
import { PlateElement } from '@kit/plate/react';

import { Button } from '@kit/ui/plugin';

import { __ } from '@wordpress/i18n';

const headingItemVariants = cva(
  'block h-auto w-full cursor-pointer truncate rounded-none px-0.5 py-1.5 text-left font-medium underline decoration-[0.5px] underline-offset-4',
  {
    variants: {
      active: {
        false: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        true: 'bg-accent text-foreground decoration-foreground',
      },
      depth: {
        1: 'pl-0.5',
        2: 'pl-[26px]',
        3: 'pl-[50px]',
      },
    },
  },
);

/**
 * Interactive table of contents: lists document headings and scroll-jumps to
 * them. Email serialization uses the static indented title list (toc-node-static).
 */
export function TocElement(props: PlateElementProps) {
  const state = useTocElementState();
  const { props: btnProps } = useTocElement(state);
  const { activeContentId, headingList } = state;

  return (
    <PlateElement {...props} className="mb-1 p-0">
      <div contentEditable={false}>
        {headingList.length > 0 ? (
          headingList.map((item) => (
            <Button
              aria-current={
                item.id === activeContentId ? 'location' : undefined
              }
              className={headingItemVariants({
                active: item.id === activeContentId,
                depth: item.depth as 1 | 2 | 3,
              })}
              key={item.id}
              onClick={(e) => btnProps.onClick(e, item, 'smooth')}
              variant="ghost"
            >
              {item.title}
            </Button>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">
            {__(
              'Create a heading to display the table of contents.',
              'pressedmail',
            )}
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
