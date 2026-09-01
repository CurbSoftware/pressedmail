'use client';

import type * as React from 'react';
import { PlateElement } from '@kit/plate/react';

import { cn } from '@/lib/utils';

const EMOJI_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", NotoColorEmoji, "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", EmojiSymbols';

/**
 * Interactive callout: a coloured info box with a leading emoji.
 *
 * The playground variant wires an emoji picker via @platejs/emoji; PressedMail
 * keeps the icon static (non-editable) to avoid pulling the emoji-picker infra
 * into the email composer. Email serialization uses the inline-style table
 * variant in callout-node-static.tsx.
 */
export function CalloutElement({
  attributes,
  children,
  className,
  ...props
}: React.ComponentProps<typeof PlateElement>) {
  return (
    <PlateElement
      attributes={attributes}
      className={cn('my-1 flex rounded-sm bg-muted p-4 pl-3', className)}
      style={{
        backgroundColor: props.element.backgroundColor as string | undefined,
      }}
      {...props}
    >
      <div className="flex w-full gap-2 rounded-md">
        <div
          className="size-6 select-none text-[18px]"
          contentEditable={false}
          style={{ fontFamily: EMOJI_FONT_FAMILY }}
        >
          <span data-plate-prevent-deserialization>
            {(props.element.icon as string) || '💡'}
          </span>
        </div>
        <div className="w-full">{children}</div>
      </div>
    </PlateElement>
  );
}
