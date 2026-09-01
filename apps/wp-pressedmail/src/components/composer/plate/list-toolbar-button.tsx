'use client';

import * as React from 'react';
import { ListStyleType, someList, toggleList } from '@kit/plate/list';
import { List, ListOrdered } from 'lucide-react';
import { useEditorRef, useEditorSelector } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';

import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  COMPOSER_TOOLBAR_ICON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';

export function ListToolbarButton() {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const pressed = useEditorSelector(
    (editor) =>
      someList(editor, [ListStyleType.Disc, ListStyleType.Decimal]),
    [],
  );

  const applyList = (listStyleType: ListStyleType) => {
    toggleList(editor, { listStyleType });
    editor.tf.focus();
  };

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger
        asChild
        className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}
      >
        <ToolbarButton
          isDropdown
          pressed={open || pressed}
          tooltip={__('Lists', 'pressedmail')}
        >
          <List className={COMPOSER_TOOLBAR_ICON_CLASS} />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="min-w-[160px] gap-2"
            onSelect={() => applyList(ListStyleType.Disc)}
          >
            <List className={COMPOSER_TOOLBAR_ICON_CLASS} />
            {__('Bulleted list', 'pressedmail')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-w-[160px] gap-2"
            onSelect={() => applyList(ListStyleType.Decimal)}
          >
            <ListOrdered className={COMPOSER_TOOLBAR_ICON_CLASS} />
            {__('Numbered list', 'pressedmail')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
