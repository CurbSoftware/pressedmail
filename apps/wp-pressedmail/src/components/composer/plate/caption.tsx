'use client';

import * as React from 'react';
import {
  Caption as CaptionPrimitive,
  CaptionTextarea as CaptionTextareaPrimitive,
  useCaptionButton,
  useCaptionButtonState,
} from '@kit/plate/caption/react';
import { cva, type VariantProps } from 'class-variance-authority';

import { Button } from '@kit/ui/plugin';

import { cn } from '@/lib/utils';

/**
 * Media caption (template caption.tsx port). CaptionButton is hand-wired to
 * the caption hooks instead of @udecode/cn's createPrimitiveComponent (not a
 * dependency here).
 */
const captionVariants = cva('max-w-full', {
  defaultVariants: {
    align: 'center',
  },
  variants: {
    align: {
      center: 'mx-auto',
      left: 'mr-auto',
      right: 'ml-auto',
    },
  },
});

export function Caption({
  align,
  className,
  ...props
}: React.ComponentProps<typeof CaptionPrimitive> &
  VariantProps<typeof captionVariants>) {
  return (
    <CaptionPrimitive
      {...props}
      className={cn(captionVariants({ align }), className)}
    />
  );
}

export function CaptionTextarea(
  props: React.ComponentProps<typeof CaptionTextareaPrimitive>,
) {
  return (
    <CaptionTextareaPrimitive
      {...props}
      className={cn(
        'mt-2 w-full resize-none border-none bg-inherit p-0 font-[inherit] text-inherit',
        'focus:[&::placeholder]:opacity-0',
        'text-center print:placeholder:text-transparent',
        props.className,
      )}
    />
  );
}

export function CaptionButton(
  props: React.ComponentProps<typeof Button>,
) {
  const state = useCaptionButtonState();
  const { props: buttonProps } = useCaptionButton(state);

  return <Button {...buttonProps} {...props} />;
}
