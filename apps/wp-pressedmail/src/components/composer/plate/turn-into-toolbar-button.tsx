'use client';

/**
 * "Turn into" block-type dropdown (template turn-into-toolbar-button.tsx
 * port). Compared to the template this drops H4-H6 (heading plugins not
 * registered in the composer kit) and the Code Drawing entry (plugin not
 * shipped). Selection state styling uses the plugin DropdownMenuRadioItem's
 * built-in indicator instead of the template's `*:first:[span]:hidden`
 * arbitrary variants (not emitted by this app's Tailwind build).
 */

import * as React from 'react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  Columns3Icon,
  FileCodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
} from 'lucide-react';
import type { TElement } from '@kit/plate';
import { KEYS } from '@kit/plate';
import { useEditorRef, useSelectionFragmentProp } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';

import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  ToolbarButton,
  ToolbarMenuGroup,
} from '@/components/composer/toolbar';
import {
  ACTION_THREE_COLUMNS,
  getBlockType,
  setBlockType,
} from './transforms';

// Built on call: a module-level __() runs before main.tsx loads the locale
// catalog, so these labels would always be English.
export const getTurnIntoItems = () => [
  {
    icon: <PilcrowIcon />,
    keywords: ['paragraph'],
    label: __('Text', 'pressedmail'),
    value: KEYS.p,
  },
  {
    icon: <Heading1Icon />,
    keywords: ['title', 'h1'],
    label: __('Heading 1', 'pressedmail'),
    value: 'h1',
  },
  {
    icon: <Heading2Icon />,
    keywords: ['subtitle', 'h2'],
    label: __('Heading 2', 'pressedmail'),
    value: 'h2',
  },
  {
    icon: <Heading3Icon />,
    keywords: ['subtitle', 'h3'],
    label: __('Heading 3', 'pressedmail'),
    value: 'h3',
  },
  {
    icon: <ListIcon />,
    keywords: ['unordered', 'ul', '-'],
    label: __('Bulleted list', 'pressedmail'),
    value: KEYS.ul,
  },
  {
    icon: <ListOrderedIcon />,
    keywords: ['ordered', 'ol', '1'],
    label: __('Numbered list', 'pressedmail'),
    value: KEYS.ol,
  },
  {
    icon: <FileCodeIcon />,
    keywords: ['```'],
    label: __('Code', 'pressedmail'),
    value: KEYS.codeBlock,
  },
  {
    icon: <QuoteIcon />,
    keywords: ['citation', 'blockquote', '>'],
    label: __('Quote', 'pressedmail'),
    value: KEYS.blockquote,
  },
  {
    icon: <Columns3Icon />,
    label: __('3 columns', 'pressedmail'),
    value: ACTION_THREE_COLUMNS,
  },
];

export function TurnIntoToolbarButton(props: DropdownMenuProps) {
  const items = getTurnIntoItems();
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);

  const value = useSelectionFragmentProp({
    defaultValue: KEYS.p,
    getProp: (node) => getBlockType(node as TElement),
  });
  const selectedItem = React.useMemo(
    () =>
      items.find((item) => item.value === (value ?? KEYS.p)) ??
      items[0],
    [value],
  );

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className={`${COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS} justify-start`}
          isDropdown
          pressed={open}
          tooltip={__('Turn into', 'pressedmail')}
        >
          {selectedItem?.label ?? __('Text', 'pressedmail')}
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar min-w-[200px]"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.tf.focus();
        }}
      >
        <ToolbarMenuGroup
          label={__('Turn into', 'pressedmail')}
          onValueChange={(type) => {
            setBlockType(editor, type);
          }}
          value={value}
        >
          {items.map(({ icon, label, value: itemValue }) => (
            <DropdownMenuRadioItem
              className="min-w-[180px] [&_svg]:size-4 [&_svg]:text-muted-foreground"
              key={itemValue}
              value={itemValue}
            >
              <span className="mr-2 inline-flex items-center">{icon}</span>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </ToolbarMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
