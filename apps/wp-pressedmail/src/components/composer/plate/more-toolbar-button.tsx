'use client';

/**
 * "More" overflow dropdown (template more-toolbar-button.tsx port).
 * Extends the template inventory (Keyboard input / Superscript / Subscript)
 * with the composer's Clear formatting action, which moved here from a
 * standalone toolbar button. Highlight is NOT here, it has a dedicated
 * toolbar button (HighlightColorToolbarButton) with the full colour palette.
 */

import * as React from 'react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  KeyboardIcon,
  MoreHorizontalIcon,
  RemoveFormattingIcon,
  SubscriptIcon,
  SuperscriptIcon,
} from 'lucide-react';
import { KEYS } from '@kit/plate';
import { useEditorRef } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';

import {
  COMPOSER_TOOLBAR_BUTTON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';

/** Shared styling for More-menu items: sized icon + consistent icon↔label gap. */
const MORE_MENU_ITEM_CLASS =
  'gap-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

export function MoreToolbarButton({
  showClearFormatting = true,
  ...props
}: DropdownMenuProps & { showClearFormatting?: boolean }) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className={COMPOSER_TOOLBAR_BUTTON_CLASS}
          pressed={open}
          tooltip={__('More', 'pressedmail')}
        >
          <MoreHorizontalIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar flex max-h-[500px] min-w-[180px] flex-col overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            className={MORE_MENU_ITEM_CLASS}
            onSelect={() => {
              editor.tf.toggleMark(KEYS.kbd);
              editor.tf.collapse({ edge: 'end' });
              editor.tf.focus();
            }}
          >
            <KeyboardIcon />
            {__('Keyboard input', 'pressedmail')}
          </DropdownMenuItem>

          <DropdownMenuItem
            className={MORE_MENU_ITEM_CLASS}
            onSelect={() => {
              editor.tf.toggleMark(KEYS.sup, {
                remove: KEYS.sub,
              });
              editor.tf.focus();
            }}
          >
            <SuperscriptIcon />
            {__('Superscript', 'pressedmail')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={MORE_MENU_ITEM_CLASS}
            onSelect={() => {
              editor.tf.toggleMark(KEYS.sub, {
                remove: KEYS.sup,
              });
              editor.tf.focus();
            }}
          >
            <SubscriptIcon />
            {__('Subscript', 'pressedmail')}
          </DropdownMenuItem>
          {showClearFormatting && (
            <DropdownMenuItem
              className={MORE_MENU_ITEM_CLASS}
              onSelect={() => {
                clearFormatting(editor);
                editor.tf.focus();
              }}
            >
              <RemoveFormattingIcon />
              {__('Clear formatting', 'pressedmail')}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Removes every composer mark plus list/indent block props. */
function clearFormatting(editor: ReturnType<typeof useEditorRef>) {
  editor.tf.removeMarks('bold');
  editor.tf.removeMarks('italic');
  editor.tf.removeMarks('underline');
  editor.tf.removeMarks('strikethrough');
  editor.tf.removeMarks('code');
  editor.tf.removeMarks('highlight');
  editor.tf.removeMarks('kbd');
  editor.tf.removeMarks('color');
  editor.tf.removeMarks('backgroundColor');
  editor.tf.removeMarks('fontFamily');
  editor.tf.removeMarks('fontSize');
  editor.tf.unsetNodes([KEYS.listType, 'indent'], { mode: 'all' });
}
