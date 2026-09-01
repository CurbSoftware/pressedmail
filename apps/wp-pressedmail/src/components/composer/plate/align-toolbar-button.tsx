'use client';

/**
 * Block alignment dropdown (template align-toolbar-button.tsx port).
 * Selection state uses the plugin DropdownMenuRadioItem's built-in
 * indicator instead of the template's `*:first:[span]:hidden` arbitrary
 * variants (not emitted by this app's Tailwind build).
 */

import * as React from 'react';
import type { Alignment } from '@kit/plate/basic-styles';
import { TextAlignPlugin } from '@kit/plate/basic-styles/react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from 'lucide-react';
import { useEditorPlugin, useSelectionFragmentProp } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';

import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';

const items = [
  { icon: AlignLeftIcon, label: __('Align left', 'pressedmail'), value: 'left' },
  { icon: AlignCenterIcon, label: __('Align center', 'pressedmail'), value: 'center' },
  { icon: AlignRightIcon, label: __('Align right', 'pressedmail'), value: 'right' },
  { icon: AlignJustifyIcon, label: __('Justify', 'pressedmail'), value: 'justify' },
];

export function AlignToolbarButton(props: DropdownMenuProps) {
  const { editor, tf } = useEditorPlugin(TextAlignPlugin);
  const value =
    useSelectionFragmentProp({
      defaultValue: 'start',
      getProp: (node) => node.align,
    }) ?? 'left';

  const [open, setOpen] = React.useState(false);
  const IconValue =
    items.find((item) => item.value === value)?.icon ?? AlignLeftIcon;

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}
          isDropdown
          pressed={open}
          tooltip={__('Align', 'pressedmail')}
        >
          <IconValue />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-0">
        <DropdownMenuRadioGroup
          onValueChange={(newValue) => {
            tf.textAlign.setNodes(newValue as Alignment);
            editor.tf.focus();
          }}
          value={value}
        >
          {items.map(({ icon: Icon, label, value: itemValue }) => (
            <DropdownMenuRadioItem
              className="min-w-[160px] [&_svg]:size-4 [&_svg]:text-muted-foreground"
              key={itemValue}
              value={itemValue}
            >
              <span className="mr-2 inline-flex items-center">
                <Icon />
              </span>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
