'use client';

/**
 * Undo / redo toolbar buttons (template history-toolbar-button.tsx port).
 */

import * as React from 'react';
import { Redo2, Undo2 } from 'lucide-react';
import { useEditorRef, useEditorSelector } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';

import { ToolbarButton } from '@/components/composer/toolbar';

export function UndoToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>,
) {
  const editor = useEditorRef();
  const disabled = useEditorSelector(
    (editor) => !editor.history.undos?.length,
    [],
  );

  return (
    <ToolbarButton
      tooltip={__('Undo', 'pressedmail')}
      {...props}
      disabled={disabled}
      onClick={() => editor.undo()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Undo2 />
    </ToolbarButton>
  );
}

export function RedoToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>,
) {
  const editor = useEditorRef();
  const disabled = useEditorSelector(
    (editor) => !editor.history.redos?.length,
    [],
  );

  return (
    <ToolbarButton
      tooltip={__('Redo', 'pressedmail')}
      {...props}
      disabled={disabled}
      onClick={() => editor.redo()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Redo2 />
    </ToolbarButton>
  );
}
