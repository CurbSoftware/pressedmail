'use client';

/**
 * Top-level "Horizontal rule" toolbar button. The standalone Insert popover was
 * removed (Link and Table are their own top-level toolbar items); Horizontal
 * rule is the only remaining basic insertable, so it lives directly in the
 * toolbar.
 */

import { MinusIcon } from 'lucide-react';
import { KEYS } from '@kit/plate';
import { useEditorRef } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';

import {
  COMPOSER_TOOLBAR_ICON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';
import { insertBlock } from './transforms';

export function HorizontalRuleToolbarButton() {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      tooltip={__('Horizontal rule', 'pressedmail')}
      onClick={() => {
        insertBlock(editor, KEYS.hr);
        editor.tf.focus();
      }}
    >
      <MinusIcon className={COMPOSER_TOOLBAR_ICON_CLASS} />
    </ToolbarButton>
  );
}
