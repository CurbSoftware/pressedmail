'use client';

/**
 * Indent / outdent toolbar buttons (template indent-toolbar-button.tsx port).
 */

import type * as React from 'react';
import { useIndentButton, useOutdentButton } from '@kit/plate/indent/react';
import { IndentIcon, OutdentIcon } from 'lucide-react';

import { __ } from '@wordpress/i18n';

import { ToolbarButton } from '@/components/composer/toolbar';

export function IndentToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>,
) {
  const { props: buttonProps } = useIndentButton();

  return (
    <ToolbarButton
      tooltip={__('Indent', 'pressedmail')}
      {...props}
      {...buttonProps}
    >
      <IndentIcon />
    </ToolbarButton>
  );
}

export function OutdentToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>,
) {
  const { props: buttonProps } = useOutdentButton();

  return (
    <ToolbarButton
      tooltip={__('Outdent', 'pressedmail')}
      {...props}
      {...buttonProps}
    >
      <OutdentIcon />
    </ToolbarButton>
  );
}
