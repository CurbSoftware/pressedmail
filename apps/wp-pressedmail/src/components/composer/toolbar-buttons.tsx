'use client';

/**
 * Email-specific color buttons kept alongside the vendored template buttons
 * in ./plate/. Both use the PressedMail ComposerColorPalette popover (user
 * palette + recents persisted via preferences) instead of the template's
 * font-color picker, with the template's text-color trigger and a dedicated
 * highlighter glyph for highlights.
 *
 * Everything else that used to live here (marks, history, lists, align,
 * indent, link popover, hardcoded emoji grid, minimal insert/turn-into) was
 * superseded by the template ports in @/components/composer/plate/.
 */

import React from 'react';
import { useEditorRef } from '@kit/plate/react';
import { BaselineIcon, Highlighter } from 'lucide-react';

import { __ } from '@wordpress/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/plugin';

import {
  COMPOSER_TOOLBAR_BUTTON_CLASS,
  ToolbarButton,
} from './toolbar';
import { ComposerColorPalette } from '@/components/ui/color-picker/ComposerColorPalette';

/* ─── Text Color / Highlight Popover ─── */

export function TextColorToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          className={COMPOSER_TOOLBAR_BUTTON_CLASS}
          pressed={open}
          tooltip={__('Text color', 'pressedmail')}
        >
          <BaselineIcon />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <ComposerColorPalette
          level="reduced"
          onPick={(hex) => { editor.tf.addMark('color', hex); editor.tf.focus(); setOpen(false); }}
          onClear={() => { editor.tf.removeMarks('color'); editor.tf.focus(); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function HighlightColorToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          className={COMPOSER_TOOLBAR_BUTTON_CLASS}
          pressed={open}
          tooltip={__('Highlight', 'pressedmail')}
        >
          <Highlighter />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <ComposerColorPalette
          level="reduced"
          onPick={(hex) => { editor.tf.addMark('backgroundColor', hex); editor.tf.focus(); setOpen(false); }}
          onClear={() => { editor.tf.removeMarks('backgroundColor'); editor.tf.focus(); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
