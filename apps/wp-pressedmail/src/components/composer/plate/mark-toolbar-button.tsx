'use client';

/**
 * Generic mark toggle toolbar button (template mark-toolbar-button.tsx port).
 */

import type * as React from 'react';
import { useMarkToolbarButton, useMarkToolbarButtonState } from '@kit/plate/react';

import { ToolbarButton } from '@/components/composer/toolbar';

export function MarkToolbarButton({
  clear,
  nodeType,
  ...props
}: React.ComponentProps<typeof ToolbarButton> & {
  nodeType: string;
  clear?: string[] | string;
}) {
  const state = useMarkToolbarButtonState({ clear, nodeType });
  const { props: buttonProps } = useMarkToolbarButton(state);

  return <ToolbarButton {...props} {...buttonProps} />;
}
