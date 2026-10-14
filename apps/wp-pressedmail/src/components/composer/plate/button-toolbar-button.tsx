'use client';

import { MousePointerClick } from 'lucide-react';
import { useEditorRef } from '@kit/plate/react';
import type { PlateEditor } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import {
  COMPOSER_TOOLBAR_ICON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';
import { insertButtonBlock } from './button-insert';

/**
 * Insert button: drops a button block in at the caret. Its form opens on the
 * block (nodes/button-node.tsx), where it stays the way to change it later.
 */
export function InsertButtonToolbarButton({ disabled = false }: { disabled?: boolean }) {
  const editor = useEditorRef() as PlateEditor;
  return (
    <ToolbarButton
      disabled={disabled}
      tooltip={__('Insert button', 'pressedmail')}
      onClick={() => insertButtonBlock(editor)}
    >
      <MousePointerClick className={COMPOSER_TOOLBAR_ICON_CLASS} aria-hidden="true" />
    </ToolbarButton>
  );
}
